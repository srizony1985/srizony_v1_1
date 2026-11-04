import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { createGoogleJwtAssertion, assertGoogleCredentialsConfigured } from './google-auth.mjs';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const CHUNK_SIZE = 8 * 1024 * 1024; // Google resumable uploads require 256 KiB-aligned chunks.
let cachedToken;
let tokenExpiry = 0;

function getFolderId() {
  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.SCARLETLABS_DRIVE_FOLDER_ID || '').trim();
  if (!folderId) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to the dedicated Google Drive backup folder ID.');
  return folderId;
}

export function assertDriveConfigured() {
  assertGoogleCredentialsConfigured();
  getFolderId();
}

async function getAccessToken() {
  assertDriveConfigured();
  if (cachedToken && Date.now() < tokenExpiry - 90_000) return cachedToken;
  const assertion = createGoogleJwtAssertion(DRIVE_SCOPE);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth failed (${response.status}): ${String(data.error_description || data.error || 'Access token was not returned.').slice(0, 300)}`);
  }
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + Math.max(60, Number(data.expires_in ?? 3600)) * 1000;
  return cachedToken;
}

async function driveApi(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google Drive API ${response.status}: ${detail.slice(0, 400) || response.statusText}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function checkDriveFolder() {
  const id = getFolderId();
  const params = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,driveId,capabilities(canAddChildren,canEdit)',
  });
  const folder = await driveApi(`/files/${encodeURIComponent(id)}?${params}`);
  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID must point to a Google Drive folder, not a file.');
  }
  if (folder.capabilities?.canAddChildren === false) {
    throw new Error('The service account cannot add files to this folder. Grant Editor access or use a Shared Drive folder.');
  }
  return folder;
}

async function sha256AndMd5(filePath) {
  const sha256 = createHash('sha256');
  const md5 = createHash('md5');
  for await (const chunk of createReadStream(filePath)) {
    sha256.update(chunk);
    md5.update(chunk);
  }
  return { sha256: sha256.digest('hex'), md5: md5.digest('hex') };
}

function nextOffsetFromRange(rangeHeader, fallback = 0) {
  const match = String(rangeHeader || '').match(/bytes=0-(\d+)/i);
  if (!match) return fallback;
  return Number(match[1]) + 1;
}

async function queryUploadState(uploadUrl, total, token) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Length': '0',
      'Content-Range': `bytes */${total}`,
    },
  });
  if (response.status === 200 || response.status === 201) return { done: await response.json(), nextOffset: total };
  if (response.status === 308) return { done: null, nextOffset: nextOffsetFromRange(response.headers.get('range'), 0) };
  const detail = await response.text().catch(() => '');
  throw new Error(`Could not query Google Drive upload status (${response.status}): ${detail.slice(0, 300)}`);
}

async function uploadChunk(uploadUrl, buffer, start, total, token) {
  const end = start + buffer.byteLength - 1;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Length': String(buffer.byteLength),
          'Content-Range': `bytes ${start}-${end}/${total}`,
        },
        body: buffer,
      });
    } catch (error) {
      lastError = error;
      // A transport failure may happen after Google accepted the chunk. Ask the
      // resumable session for its committed byte range before retrying.
      try {
        const state = await queryUploadState(uploadUrl, total, token);
        if (state.done || state.nextOffset !== start) return state;
      } catch (statusError) {
        lastError = statusError;
      }
    }

    if (response) {
      if (response.status === 200 || response.status === 201) {
        return { done: await response.json(), nextOffset: total };
      }
      if (response.status === 308) {
        const nextOffset = nextOffsetFromRange(response.headers.get('range'), start);
        if (nextOffset !== start) return { done: null, nextOffset };
        // No Range header means Google has committed no bytes yet. Retry the
        // same chunk rather than treating this as an unrecoverable upload.
        lastError = new Error(`Google Drive has not acknowledged bytes ${start}-${end} yet.`);
      } else if (response.status >= 500) {
        lastError = new Error(`Temporary Drive upload error (${response.status}).`);
        try {
          const state = await queryUploadState(uploadUrl, total, token);
          if (state.done || state.nextOffset !== start) return state;
        } catch (statusError) {
          lastError = statusError;
        }
      } else {
        const detail = await response.text().catch(() => '');
        throw new Error(`Drive upload chunk failed (${response.status}): ${detail.slice(0, 300)}`);
      }
    }

    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  throw lastError instanceof Error ? lastError : new Error('Drive upload failed.');
}

export async function uploadDriveBackup(filePath, { name, prefix, timestamp } = {}) {
  assertDriveConfigured();
  const folder = await checkDriveFolder();
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile() || fileInfo.size <= 0) throw new Error('The backup archive is missing or empty.');
  const integrity = await sha256AndMd5(filePath);
  const filePrefix = (prefix || 'srizony-foundation-full-backup').trim();
  const fileName = name || `${filePrefix}-${timestamp || new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.tar\.gz$/.test(fileName)) throw new Error('The Drive backup filename is invalid.');

  const token = await getAccessToken();
  const metadata = {
    name: fileName,
    mimeType: 'application/gzip',
    parents: [folder.id],
    description: `Srizony Foundation full backup. SHA-256: ${integrity.sha256}`,
    appProperties: { application: 'srizony-foundation', backupType: 'full', sha256: integrity.sha256 },
  };
  const start = await fetch(`${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,createdTime,webViewLink,driveId`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/gzip',
      'X-Upload-Content-Length': String(fileInfo.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) {
    const detail = await start.text().catch(() => '');
    const quotaHint = /storageQuotaExceeded|quota/i.test(detail)
      ? ' Service accounts do not have personal Drive storage quota; use a Shared Drive where the service account is a member, or a user-owned delegated OAuth integration.'
      : '';
    throw new Error(`Could not start Google Drive backup upload (${start.status}): ${detail.slice(0, 400)}${quotaHint}`);
  }
  const uploadUrl = start.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive did not return a resumable upload URL.');

  const handle = await open(filePath, 'r');
  let offset = 0;
  let remote;
  try {
    while (offset < fileInfo.size) {
      const length = Math.min(CHUNK_SIZE, fileInfo.size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead !== length) throw new Error('The local backup archive changed during upload.');
      const chunkResult = await uploadChunk(uploadUrl, buffer, offset, fileInfo.size, token);
      remote = chunkResult.done ?? remote;
      if (!chunkResult.done && chunkResult.nextOffset <= offset) {
        throw new Error(`Google Drive accepted no bytes at offset ${offset}; refusing to loop indefinitely.`);
      }
      offset = chunkResult.nextOffset;
      process.stdout.write(`\rGoogle Drive upload: ${Math.min(100, Math.round(offset / fileInfo.size * 100))}%`);
    }
  } finally {
    await handle.close();
  }
  process.stdout.write('\n');
  if (!remote?.id) throw new Error('Google Drive upload ended without a completed file response.');
  if (Number(remote.size) !== fileInfo.size) throw new Error(`Drive read-back metadata size mismatch: expected ${fileInfo.size}, received ${remote.size}.`);
  if (remote.md5Checksum && remote.md5Checksum.toLowerCase() !== integrity.md5) {
    throw new Error('Google Drive checksum verification failed. The uploaded archive does not match the local file.');
  }
  return { ...remote, sha256: integrity.sha256, size: fileInfo.size, folderName: folder.name };
}

export async function listDriveBackups({ prefix = 'srizony-foundation-full-backup', pageSize = 1000 } = {}) {
  const folderId = getFolderId();
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,appProperties)',
      pageSize: String(Math.min(1000, Math.max(1, pageSize))),
      spaces: 'drive',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      orderBy: 'createdTime desc',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await driveApi(`/files?${params}`);
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files
    .filter((file) => file.name?.startsWith(`${prefix}-`) && file.name.endsWith('.tar.gz'))
    .sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
}

export async function pruneDriveBackups({ prefix = 'srizony-foundation-full-backup', retentionDays = 35 } = {}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3650) {
    throw new Error('BACKUP_DRIVE_RETENTION_DAYS must be an integer between 0 and 3650.');
  }
  if (retentionDays === 0) return { trashed: 0, kept: 0 };
  const files = await listDriveBackups({ prefix });
  // Never touch files unless this app's private Drive metadata identifies them as full backups.
  const managed = files.filter((file) => file.appProperties?.application === 'srizony-foundation' && file.appProperties?.backupType === 'full');
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const keepIds = new Set(managed.slice(0, 2).map((file) => file.id));
  let trashed = 0;
  for (const file of managed) {
    const created = Date.parse(file.createdTime || '');
    if (!Number.isFinite(created) || created >= cutoff || keepIds.has(file.id)) continue;
    await driveApi(`/files/${encodeURIComponent(file.id)}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
    trashed += 1;
  }
  return { trashed, kept: managed.length - trashed };
}
