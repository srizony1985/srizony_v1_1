import 'server-only'
import { createPrivateKey, createSign, randomBytes } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

type ServiceAccount = { clientEmail: string; privateKey: string }
let tokenCache: { token: string; expiresAt: number } | null = null

function decodeBase64(value: string, label: string) {
  try { return Buffer.from(value, 'base64').toString('utf8') }
  catch { throw new Error(`Could not decode Base64 ${label}.`) }
}

function parseServiceAccountJson(raw?: string) {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw.trim().replace(/^\uFEFF/, '')) as unknown
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
  let privateKey = rawPrivateKey.trim().replace(/^\uFEFF/, '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\r\n?/g, '\n')
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
  const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,driveId,trashed,capabilities(canAddChildren,canEdit)`)
  const folder = await response.json() as { id: string; name: string; mimeType: string; driveId?: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean; canEdit?: boolean } }
  if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed) throw new Error('GOOGLE_DRIVE_FOLDER_ID must point to an active Google Drive folder.')
  if (folder.capabilities?.canEdit === false) throw new Error('The service account cannot edit this folder. Share it with the service-account email as Editor.')
  // A service account may edit files that already exist in a personal My Drive
  // folder even when it is not allowed to create new children there.
  return folder
}

export async function listGoogleDriveBackups() {
  const folder = await checkGoogleDriveConnection()
  const files: Array<{ id: string; name: string; mimeType?: string; createdTime?: string; modifiedTime?: string; size?: string; webViewLink?: string; appProperties?: Record<string, string>; capabilities?: { canEdit?: boolean } }> = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${folder.id.replace(/'/g, "\\'")}' in parents and trashed=false`,
      pageSize: '1000',
      spaces: 'drive',
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,appProperties,capabilities(canEdit))',
      orderBy: 'name',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await driveFetch(`${DRIVE_API}/files?${params}`)
    const listing = await response.json() as { nextPageToken?: string; files?: typeof files }
    files.push(...(listing.files ?? []))
    pageToken = listing.nextPageToken
  } while (pageToken)
  const backups = files
    .filter((file) => file.name.endsWith('.json') && file.mimeType !== 'application/vnd.google-apps.folder')
    .sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')))
    .slice(0, 100)
    .map((file) => ({
      id: file.id,
      name: file.name,
      createdTime: file.modifiedTime ?? file.createdTime ?? null,
      sizeBytes: Number(file.size ?? 0),
      webViewLink: file.webViewLink ?? null,
      sha256: file.appProperties?.sha256 ?? null,
      canEdit: file.capabilities?.canEdit !== false,
    }))
  return { folderName: folder.name, isSharedDrive: Boolean(folder.driveId), canAddChildren: folder.capabilities?.canAddChildren !== false, backups }
}

export async function readDriveJson<T = unknown>(name: string): Promise<T | null> {
  const safeName = safeDriveName(name)
  const q = new URLSearchParams({
    q: `name='${safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${folderId()}' in parents and trashed=false`,
    pageSize: '10',
    fields: 'files(id,name,mimeType)',
    spaces: 'drive',
  })
  const listing = await (await driveFetch(`${DRIVE_API}/files?${q}`)).json() as { files?: Array<{ id: string; name: string; mimeType?: string }> }
  const matches = listing.files ?? []
  if (!matches.length) return null
  if (matches.length > 1) throw new Error(`Found duplicate Google Drive files named "${safeName}". Keep exactly one.`)
  if (matches[0].mimeType === 'application/vnd.google-apps.folder' || matches[0].mimeType?.startsWith('application/vnd.google-apps.')) throw new Error(`"${safeName}" must be a real JSON file.`)
  const content = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(matches[0].id)}?alt=media`)
  try { return await content.json() as T }
  catch { throw new Error(`The contents of ${safeName} are not valid JSON.`) }
}

export async function writeDriveJson(name: string, value: unknown) {
  const safeName = safeDriveName(name)
  const q = new URLSearchParams({
    q: `name='${safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${folderId()}' in parents and trashed=false`,
    pageSize: '10',
    fields: 'files(id,name,mimeType,capabilities(canEdit))',
    spaces: 'drive',
  })
  const listing = await (await driveFetch(`${DRIVE_API}/files?${q}`)).json() as { files?: Array<{ id: string; name: string; mimeType?: string; capabilities?: { canEdit?: boolean } }> }
  const matches = listing.files ?? []
  if (!matches.length) throw new Error(`Refusing to create "${safeName}". Create the JSON file in your Gmail My Drive folder first and share it with the service account as Editor.`)
  if (matches.length > 1) throw new Error(`Found duplicate Google Drive files named "${safeName}". Keep exactly one.`)
  const existing = matches[0]
  if (existing.mimeType === 'application/vnd.google-apps.folder' || existing.mimeType?.startsWith('application/vnd.google-apps.')) throw new Error(`"${safeName}" must be a real uploaded .json file.`)
  if (existing.capabilities?.canEdit === false) throw new Error(`The service account cannot edit "${safeName}". Grant Editor access to this file or its parent folder.`)
  const boundary = `srizony_${cryptoRandomBoundary()}`
  const metadata = { name: safeName, mimeType: 'application/json' }
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(value), `--${boundary}--`, '',
  ].join('\r\n')
  const endpoint = `${UPLOAD_API}/files/${encodeURIComponent(existing.id)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime`
  const response = await driveFetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
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
