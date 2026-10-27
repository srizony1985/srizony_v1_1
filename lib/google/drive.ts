import 'server-only'
import { createSign, randomBytes } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

type ServiceAccount = { clientEmail: string; privateKey: string }
let tokenCache: { token: string; expiresAt: number } | null = null

function getServiceAccount(): ServiceAccount {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  if (!clientEmail || !privateKey) throw new Error('Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.')
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
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  if (!id) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to a folder shared with the service account or a shared-drive folder.')
  return id
}

export async function checkGoogleDriveConnection() {
  const id = folderId()
  const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,driveId,capabilities(canAddChildren,canEdit)`)
  return await response.json() as { id: string; name: string; mimeType: string; driveId?: string; capabilities?: { canAddChildren?: boolean; canEdit?: boolean } }
}

export async function readDriveJson<T = unknown>(name: string): Promise<T | null> {
  const safeName = safeDriveName(name)
  const q = encodeURIComponent(`name='${safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${folderId()}' in parents and trashed=false`)
  const listResponse = await driveFetch(`${DRIVE_API}/files?q=${q}&pageSize=10&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`)
  const listing = await listResponse.json() as { files?: Array<{ id: string }> }
  const file = listing.files?.[0]
  if (!file) return null
  const content = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`)
  return await content.json() as T
}

export async function writeDriveJson(name: string, value: unknown) {
  const safeName = safeDriveName(name)
  const existing = await findFileId(safeName)
  const metadata = { name: safeName, mimeType: 'application/json', ...(existing ? {} : { parents: [folderId()] }) }
  const boundary = `srizony_${cryptoRandomBoundary()}`
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(value), `--${boundary}--`, '',
  ].join('\r\n')
  const endpoint = existing
    ? `${UPLOAD_API}/files/${encodeURIComponent(existing)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime` 
    : `${UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime` 
  const response = await driveFetch(endpoint, { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
  return await response.json() as { id: string; name: string; modifiedTime?: string }
}

async function findFileId(name: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and '${folderId()}' in parents and trashed=false`)
  const response = await driveFetch(`${DRIVE_API}/files?q=${q}&pageSize=10&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`)
  const result = await response.json() as { files?: Array<{ id: string }> }
  return result.files?.[0]?.id ?? null
}

function safeDriveName(name: string) {
  const safe = name.trim()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(safe)) throw new Error('Drive JSON filenames must be safe .json filenames.')
  return safe
}

function cryptoRandomBoundary() {
  return randomBytes(18).toString('hex')
}
