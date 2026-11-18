import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { classifyImageSource } from './media-source.mjs';

function isReadyImage(row) {
  const kind = String(row?.kind || '').trim().toLowerCase();
  const contentType = String(row?.content_type || '').trim().toLowerCase();
  const status = String(row?.status || 'ready').trim().toLowerCase();
  return (kind === 'image' || contentType.startsWith('image/')) && status === 'ready';
}

function safeSourceLabel(value) {
  const source = String(value || '').trim();
  if (!source) return '(empty)';
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' || url.protocol === 'http:') return `${url.origin}${url.pathname}`;
  } catch { /* not a URL */ }
  return source.slice(0, 200);
}

/**
 * Classifies rows that cannot be recovered by the exact same source resolver
 * used by the backup exporter. Approved remote/local/object-storage assets are
 * retained even when storage_key is NULL. Unapproved HTTPS URLs are reported
 * for manual allow-list review, never automatically deleted.
 */
export async function buildUnrecoverableMediaPlan(rows, options = {}) {
  const candidates = [];
  const manualReview = [];
  const keep = [];
  const allowedHosts = options.allowedHosts;
  const projectRoot = options.projectRoot || process.cwd();

  for (const row of rows || []) {
    if (!isReadyImage(row)) {
      keep.push({ id: String(row?.id ?? 'unknown'), reason: 'not-a-ready-image' });
      continue;
    }

    const id = String(row.id ?? '').trim();
    if (!/^\d+$/.test(id)) {
      manualReview.push({ id: id || 'unknown', src: safeSourceLabel(row.src), reason: 'invalid-database-id' });
      continue;
    }

    const source = classifyImageSource(row, { projectRoot, allowedHosts });
    if (source.type === 'object-storage' || source.type === 'approved-remote') {
      keep.push({ id, reason: source.type });
      continue;
    }

    if (source.type === 'project-public') {
      try {
        await access(source.path, fsConstants.R_OK);
        keep.push({ id, reason: 'project-public-file-exists' });
      } catch {
        candidates.push({
          id,
          src: safeSourceLabel(row.src),
          storageKey: String(row.storage_key || '').trim() || null,
          reason: 'project-public-file-missing',
        });
      }
      continue;
    }

    // A syntactically valid HTTPS URL on an unapproved host is potentially
    // recoverable by adding the exact hostname to the allow-list.
    const rawSrc = String(row.src || '').trim();
    const parsedHttp = (() => {
      try { return new URL(rawSrc); } catch { return null; }
    })();
    if ((parsedHttp?.protocol === 'https:' || parsedHttp?.protocol === 'http:') && !parsedHttp.username && !parsedHttp.password) {
      manualReview.push({
        id,
        src: safeSourceLabel(rawSrc),
        reason: parsedHttp.protocol === 'https:'
          ? `https-host-not-allowlisted:${parsedHttp.hostname.toLowerCase()}`
          : `insecure-http-source-needs-migration:${parsedHttp.hostname.toLowerCase()}`,
      });
      continue;
    }

    const candidate = {
      id,
      src: safeSourceLabel(row.src),
      storageKey: String(row.storage_key || '').trim() || null,
      reason: 'no-recoverable-storage-key-or-source',
    };
    candidates.push(candidate);
  }

  return { candidates, manualReview, keep };
}

/**
 * A row can be removed only when all populated referencing constraints use
 * SET NULL or CASCADE. RESTRICT, NO ACTION and SET DEFAULT references block
 * cleanup. The caller supplies reference counts from PostgreSQL.
 */
export function getDeleteBlockers(references) {
  return (references || [])
    .filter((reference) => Number(reference.count) > 0 && !['n', 'c'].includes(reference.deleteAction))
    .map((reference) => ({
      table: reference.table,
      columns: reference.columns,
      count: Number(reference.count),
      deleteAction: reference.deleteAction,
      constraint: reference.constraint,
    }));
}

export function summarizeDeleteEffects(references) {
  return (references || [])
    .filter((reference) => Number(reference.count) > 0)
    .map((reference) => ({
      table: reference.table,
      columns: reference.columns,
      count: Number(reference.count),
      effect: reference.deleteAction === 'c' ? 'cascade-delete' : reference.deleteAction === 'n' ? 'set-null' : 'blocked',
      constraint: reference.constraint,
    }));
}

export { isReadyImage, safeSourceLabel };
