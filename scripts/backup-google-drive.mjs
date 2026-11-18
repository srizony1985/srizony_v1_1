#!/usr/bin/env node
/**
 * Full Srizony Foundation backup to Google Drive.
 * Keeps Neon PostgreSQL as the source of truth; this is a backup archive,
 * not a switch to the Google Drive JSON database provider used by SL.
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { chmod, mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertDriveConfigured, checkDriveFolder, uploadDriveBackup, pruneDriveBackups } from './lib/google-drive.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    process.env[match[1]] = value;
  }
}

function required(name, fallback) {
  const value = (process.env[name] || fallback || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) reject(new Error(`${command} exited with code ${code}${stderr.trim() ? `: ${stderr.trim().slice(0, 600)}` : ''}`));
      else resolve(options.capture ? stdout.trim() : '');
    });
  });
}

function safeBucketName(name) {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const databaseUrl = required('BACKUP_DATABASE_URL', process.env.DATABASE_URL);
  let databaseHost = '';
  try { databaseHost = new URL(databaseUrl).hostname; } catch { throw new Error('BACKUP_DATABASE_URL must be a valid PostgreSQL connection URL.'); }
  if (/pooler/i.test(databaseHost)) throw new Error('Use a direct, non-pooled PostgreSQL connection URL for BACKUP_DATABASE_URL.');
  if (/USER:PASSWORD|ep-xxxx|\.REGION\./i.test(databaseUrl)) throw new Error('BACKUP_DATABASE_URL still looks like a placeholder.');

  const includeStorage = !['0', 'false', 'no', 'off'].includes((process.env.BACKUP_INCLUDE_OBJECT_STORAGE || 'true').trim().toLowerCase());
  const privateBucket = (process.env.NEON_OBJECT_STORAGE_BUCKET || 'uploads').trim();
  const publicBucket = (process.env.NEON_PUBLIC_ASSETS_BUCKET || 'public-assets').trim();
  if (includeStorage) {
    required('AWS_ENDPOINT_URL_S3');
    required('AWS_REGION');
    required('AWS_ACCESS_KEY_ID');
    required('AWS_SECRET_ACCESS_KEY');
    if (!safeBucketName(privateBucket) || !safeBucketName(publicBucket) || privateBucket === publicBucket) {
      throw new Error('NEON_OBJECT_STORAGE_BUCKET and NEON_PUBLIC_ASSETS_BUCKET must be distinct valid bucket names.');
    }
  }

  const prefix = (process.env.GOOGLE_DRIVE_BACKUP_PREFIX || 'srizony-foundation-full-backup').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(prefix)) throw new Error('GOOGLE_DRIVE_BACKUP_PREFIX contains unsupported characters.');
  const retentionDays = Number(process.env.BACKUP_DRIVE_RETENTION_DAYS ?? '0');
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3650) throw new Error('BACKUP_DRIVE_RETENTION_DAYS must be an integer between 0 and 3650.');

  assertDriveConfigured();
  const folder = await checkDriveFolder();
  console.log(`Google Drive destination: ${folder.name}${folder.driveId ? ' (Shared Drive)' : ''}`);
  console.log(`Backup scope: PostgreSQL${includeStorage ? ` + ${privateBucket} + ${publicBucket} object storage` : ' only (object-storage backup disabled)'}`);

  const pgDumpVersion = await run('pg_dump', ['--version'], { capture: true });
  const installedMajor = Number(pgDumpVersion.match(/\(PostgreSQL\)\s+(\d+)/)?.[1]);
  const expectedMajor = process.env.PG_DUMP_MAJOR?.trim();
  if (expectedMajor && Number(expectedMajor) !== installedMajor) {
    throw new Error(`pg_dump major version mismatch: expected ${expectedMajor}, installed ${installedMajor || 'unknown'} (${pgDumpVersion}).`);
  }

  const backupStartedAt = new Date();
  const stamp = backupStartedAt.toISOString().replace(/[:.]/g, '-');
  const archiveName = `${prefix}-${stamp}.tar.gz`;
  const workDir = await mkdtemp(path.join(tmpdir(), 'srizony-drive-backup-'));
  const archivePath = path.join(tmpdir(), archiveName);
  const oldAwsConfig = process.env.AWS_CONFIG_FILE;
  try {
    await chmod(workDir, 0o700);
    await mkdir(path.join(workDir, 'storage'), { recursive: true, mode: 0o700 });
    const databaseDump = path.join(workDir, 'database.dump');
    console.log(`Creating PostgreSQL custom-format archive with ${pgDumpVersion}…`);
    const databaseDumpStartedAt = new Date().toISOString();
    await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', databaseDump, '--dbname', databaseUrl]);
    const databaseDumpCompletedAt = new Date().toISOString();
    if ((await stat(databaseDump)).size <= 0) throw new Error('pg_dump produced an empty database archive.');
    const databaseSha256 = await sha256File(databaseDump);
    await writeFile(path.join(workDir, 'database.dump.sha256'), `${databaseSha256}  database.dump\n`, { mode: 0o600 });

    let objectStorageCopyStartedAt = null;
    let objectStorageCopyCompletedAt = null;
    if (includeStorage) {
      objectStorageCopyStartedAt = new Date().toISOString();
      const awsConfig = path.join(workDir, 'aws-config');
      await writeFile(awsConfig, `[default]\nregion = ${process.env.AWS_REGION}\ns3 =\n    addressing_style = path\n`, { mode: 0o600 });
      process.env.AWS_CONFIG_FILE = awsConfig;
      process.env.AWS_EC2_METADATA_DISABLED = 'true';
      const privatePath = path.join(workDir, 'storage', privateBucket);
      const publicPath = path.join(workDir, 'storage', publicBucket);
      await mkdir(privatePath, { recursive: true, mode: 0o700 });
      await mkdir(publicPath, { recursive: true, mode: 0o700 });
      console.log(`Copying private object-storage bucket: ${privateBucket}…`);
      await run('aws', ['--endpoint-url', process.env.AWS_ENDPOINT_URL_S3, 's3', 'sync', `s3://${privateBucket}/`, `${privatePath}/`, '--only-show-errors']);
      console.log(`Copying public object-storage bucket: ${publicBucket}…`);
      await run('aws', ['--endpoint-url', process.env.AWS_ENDPOINT_URL_S3, 's3', 'sync', `s3://${publicBucket}/`, `${publicPath}/`, '--only-show-errors']);
      objectStorageCopyCompletedAt = new Date().toISOString();
      await rm(awsConfig, { force: true });
    }

    const runtimeConfig = {
      environment: process.env.NODE_ENV || 'production',
      timezone: 'Asia/Dhaka',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || null,
      privateStorageBucket: privateBucket,
      publicStorageBucket: publicBucket,
      // Never serialize credentials, connection strings, tokens, or private keys.
    };
    await writeFile(path.join(workDir, 'runtime-config.json'), `${JSON.stringify(runtimeConfig, null, 2)}\n`, { mode: 0o600 });
    const manifest = {
      format: 'srizony-foundation-full-backup',
      version: 1,
      backupUtc: backupStartedAt.toISOString(),
      backupStartedAt: backupStartedAt.toISOString(),
      databaseSnapshot: { startedAt: databaseDumpStartedAt, completedAt: databaseDumpCompletedAt },
      backupTimezone: 'Asia/Dhaka',
      gitCommit: process.env.GITHUB_SHA || null,
      database: { file: 'database.dump', format: 'pg_dump-custom', pgDumpVersion, sha256: databaseSha256 },
      configuration: { source: 'PostgreSQL CMS configuration and application runtime-config.json', runtimeConfigFile: 'runtime-config.json', secretsIncluded: false },
      objectStorage: includeStorage
        ? { included: true, privateBucket, publicBucket, copyStartedAt: objectStorageCopyStartedAt, copyCompletedAt: objectStorageCopyCompletedAt }
        : { included: false },
      restoreNotes: 'Restore is destructive. The CMS-triggered workflow creates a fresh pre-restore archive, restores database.dump with pg_restore, and synchronizes both object-storage buckets to this snapshot.',
    };
    await writeFile(path.join(workDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await run('tar', ['-czf', archivePath, '-C', workDir, '.']);
    await chmod(archivePath, 0o600);

    const archiveStats = await stat(archivePath);
    console.log(`Uploading ${archiveName} (${(archiveStats.size / (1024 * 1024)).toFixed(1)} MiB) to Google Drive…`);
    const remote = await uploadDriveBackup(archivePath, { name: archiveName, prefix, timestamp: stamp, backupUtc: backupStartedAt.toISOString() });
    console.log(`Verified Google Drive backup: ${remote.name} (${remote.size} bytes, ${remote.md5Checksum || 'Drive MD5 unavailable'})`);
    console.log(`SHA-256: ${remote.sha256}`);
    console.log(`Drive file ID: ${remote.id}`);

    if (retentionDays > 0) {
      try {
        const result = await pruneDriveBackups({ prefix, retentionDays });
        console.log(`Retention: ${result.trashed} older backup(s) moved to Drive trash; ${result.kept} retained. Policy: ${retentionDays} days (at least 2 kept).`);
      } catch (error) {
        console.warn(`Backup succeeded, but retention cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log('Retention cleanup disabled (BACKUP_DRIVE_RETENTION_DAYS=0).');
    }
    console.log('Google Drive backup completed successfully.');
  } finally {
    if (oldAwsConfig === undefined) delete process.env.AWS_CONFIG_FILE;
    else process.env.AWS_CONFIG_FILE = oldAwsConfig;
    await rm(workDir, { recursive: true, force: true });
    await rm(archivePath, { force: true });
  }
}

main().catch((error) => {
  console.error(`Google Drive backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
