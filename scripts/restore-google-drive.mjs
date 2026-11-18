#!/usr/bin/env node
/**
 * Restores a verified Srizony full point-in-time archive to the configured
 * production Neon database and matching object-storage buckets. The workflow
 * creates a fresh pre-restore backup before invoking this destructive script.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { downloadDriveBackup } from './lib/google-drive.mjs';

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

function argsMap(argv) {
  const result = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) throw new Error(`Unexpected argument: ${argv[i]}`);
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    result.set(key, value); i += 1;
  }
  return result;
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: root, env: process.env, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  const { createReadStream } = await import('node:fs');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function safeArchiveEntries(entries) {
  for (const entry of entries) {
    const normalized = entry.replace(/^\.\//, '').replace(/\/$/, '');
    if (!normalized) continue;
    if (normalized.startsWith('/') || normalized.includes('\\') || normalized.split('/').some((part) => part === '..')) {
      throw new Error(`Unsafe path in backup archive: ${entry}`);
    }
  }
}

async function main() {
  loadEnvFile('.env.local'); loadEnvFile('.env');
  const args = argsMap(process.argv.slice(2));
  const fileId = args.get('file-id') || process.env.RESTORE_FILE_ID || '';
  const confirmation = args.get('confirm') || process.env.CONFIRM_RESTORE || '';
  if (confirmation !== 'RESTORE PRODUCTION') throw new Error('Restore cancelled. Explicit confirmation must equal RESTORE PRODUCTION.');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new Error('A valid Google Drive backup file ID is required.');

  const databaseUrl = required('BACKUP_DATABASE_URL', process.env.DATABASE_URL);
  let databaseHost = '';
  try { databaseHost = new URL(databaseUrl).hostname; } catch { throw new Error('BACKUP_DATABASE_URL must be a valid PostgreSQL connection URL.'); }
  if (/pooler/i.test(databaseHost)) throw new Error('Use a direct, non-pooled PostgreSQL connection URL for BACKUP_DATABASE_URL.');
  if (/USER:PASSWORD|ep-xxxx|\.REGION\./i.test(databaseUrl)) throw new Error('BACKUP_DATABASE_URL still looks like a placeholder.');

  const workDir = await mkdtemp(path.join(tmpdir(), 'srizony-restore-'));
  const archivePath = path.join(workDir, 'selected-backup.tar.gz');
  const extractDir = path.join(workDir, 'archive');
  try {
    console.log('Downloading selected backup from the configured Google Drive folder…');
    const remote = await downloadDriveBackup(fileId, archivePath);
    console.log(`Verified archive: ${remote.name} (${remote.size} bytes, SHA-256 ${remote.sha256}).`);

    const listing = await new Promise((resolve, reject) => {
      const child = spawn('tar', ['-tzf', archivePath], { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.once('error', reject); child.once('close', (code) => code === 0 ? resolve(stdout.split(/\r?\n/).filter(Boolean)) : reject(new Error(`Could not inspect backup archive: ${stderr.slice(0, 300)}`)));
    });
    safeArchiveEntries(listing);
    if (!listing.some((entry) => /^(\.\/)?database\.dump$/.test(entry)) || !listing.some((entry) => /^(\.\/)?manifest\.json$/.test(entry))) {
      throw new Error('The selected archive is missing database.dump or manifest.json.');
    }
    await run('mkdir', ['-p', extractDir]);
    await run('tar', ['-xzf', archivePath, '-C', extractDir, '--no-same-owner', '--no-same-permissions']);

    const manifest = JSON.parse(await readFile(path.join(extractDir, 'manifest.json'), 'utf8'));
    if (manifest?.format !== 'srizony-foundation-full-backup' || manifest?.version !== 1 || manifest?.database?.format !== 'pg_dump-custom') {
      throw new Error('Unsupported point-in-time backup format.');
    }
    const dumpPath = path.join(extractDir, 'database.dump');
    if (!(await stat(dumpPath)).isFile() || (await stat(dumpPath)).size <= 0) throw new Error('The database dump is empty.');
    const actualDumpHash = await sha256File(dumpPath);
    // Validate the PostgreSQL custom archive index before overwriting either storage target.
    await run('pg_restore', ['--list', dumpPath], { stdio: 'ignore' });
    if (!/^[a-f0-9]{64}$/i.test(manifest.database.sha256 || '') || actualDumpHash !== manifest.database.sha256.toLowerCase()) {
      throw new Error('The PostgreSQL dump checksum does not match the backup manifest.');
    }

    const objectStorage = manifest.objectStorage || { included: false };
    if (objectStorage.included) {
      const privateBucket = required('NEON_OBJECT_STORAGE_BUCKET', 'uploads');
      const publicBucket = required('NEON_PUBLIC_ASSETS_BUCKET', 'public-assets');
      if (objectStorage.privateBucket !== privateBucket || objectStorage.publicBucket !== publicBucket || privateBucket === publicBucket) {
        throw new Error('Backup storage bucket names do not match the configured target buckets. Restore was stopped to prevent overwriting the wrong storage.');
      }
      for (const key of ['AWS_ENDPOINT_URL_S3', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) required(key);
      const privatePath = path.join(extractDir, 'storage', privateBucket);
      const publicPath = path.join(extractDir, 'storage', publicBucket);
      if (!(await stat(privatePath).catch(() => null)) || !(await stat(publicPath).catch(() => null))) {
        throw new Error('The archive manifest says object storage is included, but one or both bucket folders are missing.');
      }
      const awsConfig = path.join(workDir, 'aws-config');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(awsConfig, `[default]\nregion = ${process.env.AWS_REGION}\ns3 =\n    addressing_style = path\n`, { mode: 0o600 });
      process.env.AWS_CONFIG_FILE = awsConfig;
      process.env.AWS_EC2_METADATA_DISABLED = 'true';
      console.warn('Restoring private and public media buckets. Existing objects absent from this snapshot will be deleted.');
      await run('aws', ['--endpoint-url', process.env.AWS_ENDPOINT_URL_S3, 's3', 'sync', `${privatePath}/`, `s3://${privateBucket}/`, '--delete', '--only-show-errors']);
      await run('aws', ['--endpoint-url', process.env.AWS_ENDPOINT_URL_S3, 's3', 'sync', `${publicPath}/`, `s3://${publicBucket}/`, '--delete', '--only-show-errors']);
    } else {
      throw new Error('The selected point-in-time backup does not include object storage. A full website restore is not permitted.');
    }

    console.warn('Restoring PostgreSQL objects into BACKUP_DATABASE_URL. This replaces archived database objects and is destructive.');
    await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--exit-on-error', '--dbname', databaseUrl, dumpPath]);
    console.log(`Restore completed from ${remote.name}. Review the production website and CMS logs before resuming normal operations.`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Google Drive restore failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
