import type { ExternalValue, JsonValue } from '@/types/json'
import 'server-only'
import { createHash, createPrivateKey, createSign, randomBytes } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

type ServiceAccount = { clientEmail: string; privateKey: string }
let tokenCache: { token: string; expiresAt: number } | null = null
type DriveJsonFile = { id: string; name: string; mimeType?: string; capabilities?: { canEdit?: boolean; canDownload?: boolean } }
const driveJsonFileCache = new Map<string, { file: DriveJsonFile | null; fetchedAt: number }>()
const DRIVE_FILE_LOOKUP_TTL_MS = 60_000

function decodeBase64(value: string, label: string) {
  try { return Buffer.from(value, 'base64').toString('utf8') }
  catch { throw new Error(`Could not decode Base64 ${label}.`) }
}

function parseServiceAccountJson(raw?: string) {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw.trim().replace(/^\uFEFF/, '')) as JsonValue
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid')
    return parsed as { client_email?: string; private_key?: string }
  } catch {
    throw new Error('Google service-account JSON is invalid. Configure the complete downloaded JSON document or its Base64-encoded contents.')
  }
}

function getServiceAccount(): ServiceAccount {
  const encodedJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim()
  const json = encodedJson
    ? parseServiceAccountJson(decodeBase64(encodedJson, 'service-account JSON'))
    : parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const rawEmail = json?.client_email ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? ''
  const clientEmail = typeof rawEmail === 'string' ? rawEmail.trim() : ''
  const encodedKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64?.trim()
  const rawPrivateKey = json?.private_key ?? (encodedKey ? decodeBase64(encodedKey, 'private key') : process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ?? ''
  if (typeof rawPrivateKey !== 'string') throw new Error('Google service-account private key must be a string.')
  const privateKey = rawPrivateKey.trim().replace(/^\uFEFF/, '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\r\n?/g, '\n')
  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.')
  }
  let keyObject
  try { keyObject = createPrivateKey({ key: privateKey, format: 'pem' }) }
  catch { throw new Error('The Google service-account private key could not be parsed. Use the complete private_key from the downloaded service-account JSON.') }
  if (keyObject.asymmetricKeyType !== 'rsa') throw new Error('Google service-account key must be RSA for RS256 signing.')
  return { clientEmail, privateKey }
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

/** Creates a short-lived service-account JWT assertion; no refresh token is issued or stored. */
async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token
  const account = getServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: account.clientEmail,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const assertion = `${unsigned}.${signer.sign(account.privateKey).toString('base64url')}`
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store',
  })
  const payload = await response.json() as { access_token?: string; expires_in?: number; error_description?: string; error?: string }
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || 'Google OAuth token exchange failed.')
  tokenCache = { token: payload.access_token, expiresAt: Date.now() + Math.max(30, (payload.expires_in ?? 3600) - 60) * 1000 }
  return tokenCache.token
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, { ...init, headers, cache: 'no-store' })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Google Drive API (${response.status}): ${detail.slice(0, 500) || response.statusText}`)
  }
  return response
}

function folderId() {
  const id = (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.SCARLETLABS_DRIVE_FOLDER_ID)?.trim()
  if (!id) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to the dedicated backup folder shared with the service account or a Shared Drive folder.')
  return id
}

export async function checkGoogleDriveConnection() {
  const id = folderId()
  const params = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,mimeType,driveId,trashed,capabilities/canAddChildren,capabilities/canEdit,capabilities/canListChildren',
  })
  const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?${params}`)
  const folder = await response.json() as { id: string; name: string; mimeType: string; driveId?: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean; canEdit?: boolean; canListChildren?: boolean } }
  if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed) throw new Error('GOOGLE_DRIVE_FOLDER_ID must point to an active Google Drive folder.')
  if (folder.capabilities?.canListChildren === false) throw new Error('The service account cannot list files in this folder. Grant at least Viewer access to the service account or its Shared Drive membership.')
  // A service account may edit files that already exist in a personal My Drive
  // folder even when it cannot create new children. Full archive uploads require
  // a Shared Drive because a standalone service account has no personal quota.
  return folder
}

export async function listGoogleDriveBackups() {
  const folder = await checkGoogleDriveConnection()
  const files: Array<{ id: string; name: string; mimeType?: string; createdTime?: string; modifiedTime?: string; size?: string; webViewLink?: string; appProperties?: Record<string, string>; capabilities?: { canEdit?: boolean; canDownload?: boolean } }> = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${folder.id.replace(/'/g, "\\'")}' in parents and trashed=false`,
      pageSize: '1000',
      spaces: 'drive',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,appProperties,capabilities/canEdit,capabilities/canDownload)',
      orderBy: 'name',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await driveFetch(`${DRIVE_API}/files?${params}`)
    const listing = await response.json() as { nextPageToken?: string; files?: typeof files }
    files.push(...(listing.files ?? []))
    pageToken = listing.nextPageToken
  } while (pageToken)
  const backups = files
    .filter((file) => file.mimeType !== 'application/vnd.google-apps.folder' && (
      file.name.endsWith('.tar.gz') || file.name.endsWith('.json')
    ))
    .sort((a, b) => {
      const aTime = a.appProperties?.backupUtc || (a.name.endsWith('.json') ? a.modifiedTime : a.createdTime) || a.createdTime || a.modifiedTime || ''
      const bTime = b.appProperties?.backupUtc || (b.name.endsWith('.json') ? b.modifiedTime : b.createdTime) || b.createdTime || b.modifiedTime || ''
      return String(bTime).localeCompare(String(aTime))
    })
    .map((file) => ({
      id: file.id,
      name: file.name,
      type: file.name.endsWith('.tar.gz') ? 'point-in-time' as const : 'json-mirror' as const,
      createdTime: file.appProperties?.backupUtc ?? (file.name.endsWith('.json') ? file.modifiedTime : file.createdTime) ?? file.createdTime ?? file.modifiedTime ?? null,
      sizeBytes: Number(file.size ?? 0),
      webViewLink: file.webViewLink ?? null,
      sha256: file.appProperties?.sha256 ?? null,
      restorable: file.name.endsWith('.tar.gz') && file.appProperties?.application === 'srizony-foundation' && file.appProperties?.backupType === 'full' && /^[a-f0-9]{64}$/i.test(file.appProperties?.sha256 ?? ''),
      canEdit: file.capabilities?.canEdit === true,
      canDownload: file.capabilities?.canDownload === true,
    }))
  return {
    folderName: folder.name,
    isSharedDrive: Boolean(folder.driveId),
    folderCanEdit: folder.capabilities?.canEdit !== false,
    canListChildren: folder.capabilities?.canListChildren !== false,
    // Only a Shared Drive can reliably own files uploaded by this standalone service account.
    canAddChildren: Boolean(folder.driveId) && folder.capabilities?.canAddChildren === true,
    backups,
  }
}

async function findDriveJsonFile(name: string, refresh = false): Promise<DriveJsonFile | null> {
  const safeName = safeDriveName(name)
  const cached = driveJsonFileCache.get(safeName)
  if (!refresh && cached && Date.now() - cached.fetchedAt < DRIVE_FILE_LOOKUP_TTL_MS) return cached.file

  const q = new URLSearchParams({
    q: `name='${safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${folderId()}' in parents and trashed=false`,
    pageSize: '10',
    fields: 'files(id,name,mimeType,capabilities/canEdit,capabilities/canDownload)',
    spaces: 'drive',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  const listing = await (await driveFetch(`${DRIVE_API}/files?${q}`)).json() as { files?: DriveJsonFile[] }
  const matches = listing.files ?? []
  if (matches.length > 1) throw new Error(`Found duplicate Google Drive files named "${safeName}". Keep exactly one.`)
  const file = matches[0] ?? null
  if (file && (file.mimeType === 'application/vnd.google-apps.folder' || file.mimeType?.startsWith('application/vnd.google-apps.'))) {
    throw new Error(`"${safeName}" must be a real uploaded JSON file.`)
  }
  driveJsonFileCache.set(safeName, { file, fetchedAt: Date.now() })
  return file
}

/**
 * Read a JSON document and return a digest of the exact bytes received from
 * Drive. The database mirror uses this to compare each table file to the
 * SHA-256 recorded in the manifest before trusting any row.
 */
export async function readDriveJsonWithDigest<T = JsonValue>(name: string): Promise<{ value: T; sha256: string; sizeBytes: number } | null> {
  const safeName = safeDriveName(name)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await findDriveJsonFile(safeName, attempt > 0)
    if (!file) return null
    try {
      const content = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`)
      const raw = await content.text()
      let value: T
      try { value = JSON.parse(raw) as T }
      catch { throw new Error(`The contents of ${safeName} are not valid JSON.`) }
      return { value, sha256: createHash('sha256').update(raw, 'utf8').digest('hex'), sizeBytes: Buffer.byteLength(raw, 'utf8') }
    } catch (error) {
      // A Drive file may have been replaced since the cached name lookup.
      // Refresh the ID once before surfacing the error.
      driveJsonFileCache.delete(safeName)
      if (attempt === 1) throw error
    }
  }
  return null
}

/**
 * Read a JSON document from the configured Drive folder. File-ID lookup is
 * cached briefly to avoid spending an additional Drive API request for every
 * snapshot read, and Shared Drive query flags are always enabled.
 */
export async function readDriveJson<T = JsonValue>(name: string): Promise<T | null> {
  const result = await readDriveJsonWithDigest<T>(name)
  return result?.value ?? null
}

export async function writeDriveJson(name: string, value: ExternalValue) {
  const safeName = safeDriveName(name)
  const existing = await findDriveJsonFile(safeName, true)
  if (!existing) throw new Error(`Refusing to create "${safeName}". Pre-create the JSON file in the configured Drive folder and share it with the service account as Editor.`)
  if (existing.capabilities?.canEdit === false) throw new Error(`The service account cannot edit "${safeName}". Grant Editor access to this file or its parent folder.`)
  const boundary = `srizony_${cryptoRandomBoundary()}`
  const metadata = { name: safeName, mimeType: 'application/json' }
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(value), `--${boundary}--`, '',
  ].join('\r\n')
  const endpoint = `${UPLOAD_API}/files/${encodeURIComponent(existing.id)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime`
  const response = await driveFetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
  driveJsonFileCache.delete(safeName)
  return await response.json() as { id: string; name: string; modifiedTime?: string }
}

function safeDriveName(name: string) {
  const safe = name.trim()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(safe)) throw new Error('Drive JSON filenames must be safe .json filenames.')
  return safe
}

function cryptoRandomBoundary() {
  return randomBytes(18).toString('hex')
}
