import 'server-only'
import { createHash } from 'node:crypto'
import type { JsonObject } from '@/types/json'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'

export type DriveMediaBackup = {
  id: number
  storageKey: string | null
  storageBucket: string | null
  src: string | null
  contentType: string
  sizeBytes: number
  status: string
  isPublic: boolean
  kind: string
  data: Buffer
  snapshotAt: string
  snapshotAgeMs: number
}

function text(value: JsonObject[string] | undefined): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
}

function number(value: JsonObject[string] | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function boolean(value: JsonObject[string] | undefined): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function safeImageContentType(value: string, key: string): string | null {
  if (/^image\/(?:jpeg|png|webp|avif|gif|svg\+xml)$/i.test(value)) return value.toLowerCase()
  const extension = key.toLowerCase().split('.').pop()
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml',
  }
  return extension ? byExtension[extension] ?? null : null
}

function decodeVerifiedImage(row: JsonObject, storageKey: string): { data: Buffer; contentType: string } | null {
  if (text(row.backupEncoding) !== 'base64') return null
  const base64 = text(row.backupBase64)
  const expectedHash = text(row.backupSha256).toLowerCase()
  if (!base64 || base64.length > 80 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return null

  const data = Buffer.from(base64, 'base64')
  if (!data.byteLength || data.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) return null

  const declaredSize = number(row.size_bytes)
  if (declaredSize > 0 && declaredSize !== data.byteLength) return null

  const actualHash = createHash('sha256').update(data).digest('hex')
  if (actualHash !== expectedHash) return null

  const contentType = safeImageContentType(text(row.backupContentType || row.content_type), storageKey)
  return contentType ? { data, contentType } : null
}

function canonicalMediaKey(value: string): string {
  const candidate = value.trim().replace(/^\//, '')
  if (candidate.startsWith('media/')) return candidate
  try {
    const path = new URL(candidate).pathname
    const match = path.match(/(?:^|\/)(?:uploads|public-assets)\/(media\/.+)$/i) || path.match(/(?:^|\/)(media\/.+)$/)
    return match ? match[1].split('/').map((part) => decodeURIComponent(part)).join('/') : ''
  } catch { return '' }
}

function isSafeMediaKey(value: string): boolean {
  return value.startsWith('media/') && !value.startsWith('/') && !value.includes('\\')
    && !value.split('/').some((part) => !part || part === '.' || part === '..')
}

function mapMedia(row: JsonObject, snapshotAt: string, snapshotAgeMs: number): DriveMediaBackup | null {
  const id = number(row.id)
  // backupStorageKey is written only into the Drive snapshot for bundled/remote
  // images that do not have an S3 object key. It is never persisted to Neon.
  const storageKey = text(row.storage_key) || text(row.backupStorageKey) || null
  const src = text(row.src) || null
  const key = canonicalMediaKey(storageKey || '') || canonicalMediaKey(src || '')
  if (!Number.isSafeInteger(id) || id <= 0 || text(row.status) !== 'ready' || text(row.kind) !== 'image' || !isSafeMediaKey(key)) return null
  const decoded = decodeVerifiedImage(row, key)
  if (!decoded) return null
  return {
    id,
    storageKey,
    storageBucket: text(row.storage_bucket) || null,
    src,
    contentType: decoded.contentType,
    sizeBytes: decoded.data.byteLength,
    status: 'ready',
    isPublic: boolean(row.is_public),
    kind: 'image',
    data: decoded.data,
    snapshotAt,
    snapshotAgeMs,
  }
}

async function findBackup(predicate: (row: JsonObject) => boolean): Promise<DriveMediaBackup | null> {
  const snapshot = await readDriveTableSnapshotInfo('media_items')
  if (!snapshot) return null
  const row = snapshot.rows.find((candidate) => predicate(candidate))
  return row ? mapMedia(row, snapshot.exportedAt, snapshot.ageMs) : null
}

/** Read a public, ready image payload embedded in the validated Drive table mirror. */
export async function readDriveBackedMediaById(id: number): Promise<DriveMediaBackup | null> {
  return findBackup((row) => number(row.id) === id)
}

/** Read a public, ready image payload by its canonical storage key. */
export async function readDriveBackedMediaByKey(key: string): Promise<DriveMediaBackup | null> {
  if (!isSafeMediaKey(key)) return null
  return findBackup((row) => canonicalMediaKey(text(row.storage_key)) === key
    || canonicalMediaKey(text(row.backupStorageKey)) === key
    || canonicalMediaKey(text(row.src)) === key)
}
