import { Pool } from '@neondatabase/serverless';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { allowedRemoteImageHosts } from './lib/media-source.mjs';
import { buildUnrecoverableMediaPlan, getDeleteBlockers, summarizeDeleteEffects } from './lib/media-cleanup.mjs';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const apply = process.argv.includes('--apply');
const databaseUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '').trim();
if (!databaseUrl) throw new Error('Set BACKUP_DATABASE_URL or DATABASE_URL before running media cleanup.');

const allowedHosts = allowedRemoteImageHosts(process.env.DRIVE_JSON_IMAGE_FETCH_HOSTS || '');
const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 20_000,
  idleTimeoutMillis: 5_000,
  application_name: 'sf-media-cleanup',
});
let client;
const qIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

async function getMediaRows() {
  const result = await client.query(`
    SELECT id::text AS id, src, storage_key, storage_bucket, content_type, kind, status
    FROM public.media_items
    ORDER BY id ASC
  `);
  return result.rows;
}

async function getForeignKeys() {
  const result = await client.query(`
    SELECT
      child_ns.nspname AS schema_name,
      child_table.relname AS table_name,
      constraint_row.conname AS constraint_name,
      constraint_row.confdeltype::text AS delete_action,
      array_agg(child_column.attname ORDER BY child_key.ordinality) AS columns
    FROM pg_constraint constraint_row
    JOIN pg_class child_table ON child_table.oid = constraint_row.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child_table.relnamespace
    JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS child_key(attnum, ordinality) ON TRUE
    JOIN pg_attribute child_column ON child_column.attrelid = child_table.oid AND child_column.attnum = child_key.attnum
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.media_items'::regclass
    GROUP BY child_ns.nspname, child_table.relname, constraint_row.conname, constraint_row.confdeltype
    ORDER BY child_ns.nspname, child_table.relname, constraint_row.conname
  `);
  return result.rows.map((row) => ({
    schema: String(row.schema_name),
    table: String(row.table_name),
    constraint: String(row.constraint_name),
    deleteAction: String(row.delete_action),
    columns: Array.isArray(row.columns) ? row.columns.map(String) : [],
  }));
}

async function getReferences(id, foreignKeys) {
  const refs = [];
  for (const fk of foreignKeys) {
    if (!fk.columns.length) continue;
    const predicates = fk.columns.map((column) => `${qIdent(column)} = $1::bigint`).join(' AND ');
    const sql = `SELECT COUNT(*)::text AS count FROM ${qIdent(fk.schema)}.${qIdent(fk.table)} WHERE ${predicates}`;
    const result = await client.query({ text: sql, values: [id] });
    refs.push({
      table: `${fk.schema}.${fk.table}`,
      columns: fk.columns,
      constraint: fk.constraint,
      deleteAction: fk.deleteAction,
      count: Number(result.rows[0]?.count || 0),
    });
  }
  return refs;
}

async function main() {
  client = await pool.connect();
  await client.query('SELECT 1');

  const rows = await getMediaRows();
  const plan = await buildUnrecoverableMediaPlan(rows, {
    projectRoot: process.cwd(),
    allowedHosts,
  });
  const foreignKeys = await getForeignKeys();
  const deletions = [];
  const blocked = [];

  for (const candidate of plan.candidates) {
    const refs = await getReferences(candidate.id, foreignKeys);
    const blockers = getDeleteBlockers(refs);
    if (blockers.length) {
      blocked.push({ ...candidate, blockers, effects: summarizeDeleteEffects(refs) });
    } else {
      deletions.push({ ...candidate, effects: summarizeDeleteEffects(refs) });
    }
  }

  process.stdout.write(`Media cleanup ${apply ? 'APPLY' : 'DRY RUN'}\n`);
  process.stdout.write(`Ready image rows inspected: ${rows.filter((row) => String(row.kind || '').toLowerCase() === 'image' || String(row.content_type || '').toLowerCase().startsWith('image/')).length}\n`);
  process.stdout.write(`Unrecoverable candidates: ${plan.candidates.length}\n`);
  process.stdout.write(`Safe to delete: ${deletions.length}\n`);
  process.stdout.write(`Blocked by restrictive references: ${blocked.length}\n`);
  process.stdout.write(`Kept as recoverable/non-image: ${plan.keep.length}\n`);
  process.stdout.write(`Manual review (e.g. unapproved HTTPS hosts): ${plan.manualReview.length}\n`);

  for (const item of deletions) {
    process.stdout.write(`  ${apply ? 'DELETE' : 'WOULD DELETE'} media_items.id=${item.id}; reason=${item.reason}; src=${item.src}${item.effects.length ? `; FK effects=${item.effects.map((effect) => `${effect.table}:${effect.count}:${effect.effect}`).join(',')}` : ''}\n`);
  }
  for (const item of blocked) {
    process.stdout.write(`  BLOCKED media_items.id=${item.id}; src=${item.src}; ${item.blockers.map((ref) => `${ref.table}.${ref.columns.join('+')} (${ref.count}, ${ref.deleteAction}, ${ref.constraint})`).join('; ')}\n`);
  }
  for (const item of plan.manualReview) {
    process.stdout.write(`  MANUAL REVIEW media_items.id=${item.id}; src=${item.src}; reason=${item.reason}\n`);
  }

  if (!apply) {
    process.stdout.write('\nNo database rows were changed. Review the list, then run `npm run db:media:cleanup-unrecoverable:apply` to delete the safe candidates.\n');
    return;
  }

  if (!deletions.length) {
    process.stdout.write('\nNothing was deleted. No safe unresolved image rows were found.\n');
    return;
  }

  const reportDirectory = resolve(process.cwd(), 'drive-data');
  await mkdir(reportDirectory, { recursive: true });
  const reportPath = resolve(reportDirectory, `media-cleanup-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  await client.query('BEGIN');
  let report;
  try {
    // Lock the candidate rows and re-evaluate them inside the delete transaction.
    // If another admin repaired a key after the preview, that row is not deleted.
    const candidateIds = deletions.map((item) => item.id);
    const lockedResult = await client.query({
      text: `
        SELECT id::text AS id, src, storage_key, storage_bucket, content_type, kind, status
        FROM public.media_items
        WHERE id = ANY($1::bigint[])
        FOR UPDATE
      `,
      values: [candidateIds],
    });
    const freshPlan = await buildUnrecoverableMediaPlan(lockedResult.rows, {
      projectRoot: process.cwd(),
      allowedHosts,
    });
    const freshCandidates = freshPlan.candidates;
    const finalDeletions = [];
    const finalBlocked = [];

    for (const candidate of freshCandidates) {
      const refs = await getReferences(candidate.id, foreignKeys);
      const blockers = getDeleteBlockers(refs);
      if (blockers.length) {
        finalBlocked.push({ ...candidate, blockers, effects: summarizeDeleteEffects(refs) });
      } else {
        finalDeletions.push({ ...candidate, effects: summarizeDeleteEffects(refs) });
      }
    }

    const freshCandidateIds = new Set(freshCandidates.map((item) => item.id));
    const changedOrMissing = candidateIds.filter((id) => !freshCandidateIds.has(id));
    report = {
      format: 'srizony-media-cleanup-report-v1',
      createdAt: new Date().toISOString(),
      status: 'pending-transaction',
      mode: 'apply',
      plannedDeletes: finalDeletions,
      blockedRows: finalBlocked,
      rowsRepairedOrMissingSincePreview: changedOrMissing,
      manualReview: [...plan.manualReview, ...freshPlan.manualReview],
      note: 'Metadata-only audit. No image payload existed for the rows classified as unrecoverable.',
    };

    // Persist the plan before deleting anything, so a machine failure still
    // leaves an audit trail. The file is replaced with the committed result
    // immediately after the database transaction succeeds.
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

    const deletedRows = [];
    for (const item of finalDeletions) {
      const result = await client.query({
        text: `
          DELETE FROM public.media_items
          WHERE id = $1::bigint
            AND src IS NOT DISTINCT FROM $2::text
            AND storage_key IS NOT DISTINCT FROM $3::text
            AND lower(COALESCE(status, 'ready')) = 'ready'
            AND (lower(COALESCE(kind, '')) = 'image' OR lower(COALESCE(content_type, '')) LIKE 'image/%')
          RETURNING id::text AS id
        `,
        values: [item.id, lockedResult.rows.find((row) => String(row.id) === item.id)?.src ?? null,
          lockedResult.rows.find((row) => String(row.id) === item.id)?.storage_key ?? null],
      });
      if (result.rowCount !== 1) {
        throw new Error(`Expected to delete media_items.id=${item.id}, but the row changed or no longer qualifies. The transaction will be rolled back.`);
      }
      deletedRows.push({ id: String(result.rows[0].id), reason: item.reason, src: item.src, effects: item.effects });
    }

    await client.query('COMMIT');
    report = {
      ...report,
      status: 'committed',
      committedAt: new Date().toISOString(),
      deletedRows,
      plannedDeletes: undefined,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    process.stdout.write(`\nDeleted ${deletedRows.length} unrecoverable media row(s). Audit report: ${reportPath}\n`);
    if (finalBlocked.length) process.stdout.write(`Skipped ${finalBlocked.length} referenced row(s); resolve restrictive references before retrying the backup.\n`);
    if (changedOrMissing.length) process.stdout.write(`Skipped ${changedOrMissing.length} row(s) repaired or removed since the preview.\n`);
    if (report.manualReview.length) process.stdout.write(`Left ${report.manualReview.length} row(s) untouched for URL allow-list review.\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`Media cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await pool.end().catch(() => undefined);
}
