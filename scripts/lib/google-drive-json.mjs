import { createHash } from 'node:crypto';
import { createGoogleJwtAssertion, getGoogleServiceAccountCredentials } from './google-auth.mjs';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;
const CHUNK_SIZE = 8 * 1024 * 1024;
let cachedToken;
let tokenExpiry = 0;

export function assertDriveJsonConfigured() {
  getGoogleServiceAccountCredentials();
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()) {
    throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to the personal My Drive folder shared with the service account as Editor.');
  }
}

async function accessToken() {
  assertDriveJsonConfigured();
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createGoogleJwtAssertion(SCOPE),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth failed (${response.status}): ${String(payload.error_description || payload.error || 'No access token').slice(0, 300)}`);
  }
  cachedToken = payload.access_token;
  tokenExpiry = Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

async function request(url, init = {}) {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google Drive API ${response.status}: ${detail.slice(0, 500) || response.statusText}`);
  }
  return response;
}

function folderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
}

export async function checkDriveJsonFolder() {
  const params = new URLSearchParams({ fields: 'id,name,mimeType,driveId,trashed,capabilities(canEdit,canAddChildren)' });
  const folder = await (await request(`${DRIVE_API}/files/${encodeURIComponent(folderId())}?${params}`)).json();
  if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID must point to an active Google Drive folder.');
  }
  if (folder.capabilities?.canEdit === false) {
    throw new Error('The service account cannot access this folder with edit permission. Share the folder with the service-account email as Editor.');
  }
  // canAddChildren may be false in a consumer My Drive folder shared with a service
  // account. This workflow only replaces files that the user created beforehand.
  return folder;
}

export async function listDriveJsonFiles() {
  const folder = await checkDriveJsonFolder();
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folder.id.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,md5Checksum,webViewLink,appProperties,capabilities(canEdit))',
      pageSize: '1000',
      spaces: 'drive',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const result = await (await request(`${DRIVE_API}/files?${params}`)).json();
    files.push(...(result.files || []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return { folder, files };
}

export async function readExistingDriveJson(name, cachedListing) {
  const safeName = safeJsonName(name)
  const listing = cachedListing || await listDriveJsonFiles()
  const matches = listing.files.filter((file) => file.name === safeName)
  if (!matches.length) throw new Error(`Required Drive file "${safeName}" is missing.`)
  if (matches.length > 1) throw new Error(`Found duplicate Drive files named "${safeName}".`)
  if (matches[0].mimeType === 'application/vnd.google-apps.folder' || matches[0].mimeType?.startsWith('application/vnd.google-apps.')) throw new Error(`"${safeName}" is not a normal JSON file.`)
  const response = await request(`${DRIVE_API}/files/${encodeURIComponent(matches[0].id)}?alt=media`)
  try { return await response.json() }
  catch { throw new Error(`The existing Drive file "${safeName}" does not contain valid JSON.`) }
}

function safeJsonName(name) {
  const value = String(name || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(value)) {
    throw new Error(`Invalid Google Drive JSON filename: ${value || '(empty)'}`);
  }
  return value;
}

async function uploadChunk(uploadUrl, bytes, offset, total) {
  const end = offset + bytes.byteLength - 1;
  const token = await accessToken();
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let response;
    try {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Length': String(bytes.byteLength),
          'Content-Range': `bytes ${offset}-${end}/${total}`,
        },
        body: bytes,
      });
    } catch (error) {
      lastError = error;
    }
    if (response && (response.status === 200 || response.status === 201)) return { done: await response.json(), nextOffset: total };
    if (response?.status === 308) {
      const range = response.headers.get('range') || '';
      const match = range.match(/bytes=0-(\d+)/i);
      const nextOffset = match ? Number(match[1]) + 1 : offset;
      if (nextOffset > offset) return { done: null, nextOffset };
      lastError = new Error(`Drive has not acknowledged bytes ${offset}-${end}; retrying the same chunk.`);
    } else if (response && response.status >= 400 && response.status < 500) {
      throw new Error(`Google Drive JSON upload failed (${response.status}): ${(await response.text().catch(() => '')).slice(0, 400)}`);
    } else if (response) {
      lastError = new Error(`Temporary Google Drive upload failure (${response.status}).`);
    }
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  throw lastError instanceof Error ? lastError : new Error('Google Drive upload failed after retries.');
}

/** Replace the contents of one pre-created JSON file; this function never creates files. */
export async function writeExistingDriveJson(name, value, cachedListing) {
  return writeExistingDriveJsonText(name, `${JSON.stringify(value)}\n`, cachedListing)
}

/** Same strict update path for pre-serialized JSON, preserving PostgreSQL numeric precision. */
export async function writeExistingDriveJsonText(name, jsonText, cachedListing) {
  const safeName = safeJsonName(name);
  const listing = cachedListing || await listDriveJsonFiles();
  const matches = listing.files.filter((file) => file.name === safeName);
  if (matches.length === 0) {
    throw new Error(`Missing Drive file "${safeName}". Create an empty .json file in your Gmail My Drive folder first, then share the folder with the service account as Editor.`);
  }
  if (matches.length > 1) {
    throw new Error(`Found ${matches.length} files named "${safeName}". Keep exactly one file to avoid updating the wrong backup.`);
  }
  const existing = matches[0];
  if (existing.mimeType === 'application/vnd.google-apps.folder' || existing.mimeType?.startsWith('application/vnd.google-apps.')) {
    throw new Error(`"${safeName}" must be a real uploaded .json file, not a Google Docs/Sheets document.`);
  }
  if (existing.capabilities?.canEdit === false) {
    throw new Error(`The service account cannot edit "${safeName}". Share this file or its parent folder with the service account as Editor.`);
  }

  // The URL always contains the ID of the already-created file; no create endpoint is used.
  const bytes = Buffer.from(String(jsonText), 'utf8');
  try { JSON.parse(bytes.toString('utf8')) } catch { throw new Error(`Refusing to upload invalid JSON to \"${safeName}\".`) }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const md5 = createHash('md5').update(bytes).digest('hex');
  const token = await accessToken();
  const metadata = {
    name: safeName,
    mimeType: 'application/json',
    description: `Srizony Foundation JSON database mirror. SHA-256: ${sha256}`,
    appProperties: { application: 'srizony-foundation', backupType: 'json-table', sha256 },
  };
  let uploaded;
  if (bytes.byteLength <= SIMPLE_UPLOAD_LIMIT) {
    const boundary = `sf_json_${Math.random().toString(16).slice(2)}`;
    const preamble = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`;
    const suffix = `\r\n--${boundary}--`;
    uploaded = await (await request(`${UPLOAD_API}/files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,md5Checksum,webViewLink,appProperties`, {
      method: 'PATCH',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: Buffer.concat([Buffer.from(preamble), bytes, Buffer.from(suffix)]),
    })).json();
  } else {
    const start = await request(`${UPLOAD_API}/files/${encodeURIComponent(existing.id)}?uploadType=resumable&fields=id,name,mimeType,modifiedTime,size,md5Checksum,webViewLink,appProperties`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/json',
        'X-Upload-Content-Length': String(bytes.byteLength),
      },
      body: JSON.stringify(metadata),
    });
    const uploadUrl = start.headers.get('location');
    if (!uploadUrl) throw new Error(`Google Drive did not return a resumable session for "${safeName}".`);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.byteLength));
      const result = await uploadChunk(uploadUrl, chunk, offset, bytes.byteLength);
      if (result.done) uploaded = result.done;
      if (!result.done && result.nextOffset <= offset) throw new Error(`Google Drive made no upload progress for "${safeName}" at byte ${offset}.`);
      offset = result.nextOffset;
    }
  }
  if (!uploaded?.id) throw new Error(`Google Drive did not confirm completion for "${safeName}".`);
  if (Number(uploaded.size) !== bytes.byteLength) throw new Error(`Drive size verification failed for "${safeName}" (expected ${bytes.byteLength}, got ${uploaded.size}).`);
  if (uploaded.md5Checksum && uploaded.md5Checksum.toLowerCase() !== md5) throw new Error(`Drive MD5 verification failed for "${safeName}".`);
  return { id: uploaded.id, name: uploaded.name, sizeBytes: bytes.byteLength, sha256, md5, modifiedTime: uploaded.modifiedTime, webViewLink: uploaded.webViewLink };
}
