import path from 'node:path';
import { createHash } from 'node:crypto';

const DEFAULT_REMOTE_IMAGE_HOSTS = Object.freeze([
  'images.unsplash.com',
  'api.dicebear.com',
  'images.pexels.com',
]);

const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
});

const SUPPORTED_IMAGE_TYPES = new Set(Object.keys(MIME_EXTENSIONS));

export function allowedRemoteImageHosts(raw = '') {
  const configured = String(raw || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_REMOTE_IMAGE_HOSTS, ...configured]);
}

export function resolveObjectStorageKey(storageKey, src) {
  for (const raw of [storageKey, src]) {
    const candidate = typeof raw === 'string' ? raw.trim() : '';
    if (!candidate) continue;
    const withoutLeadingSlash = candidate.replace(/^\/+/, '');
    if (isSafeMediaKey(withoutLeadingSlash)) return withoutLeadingSlash;

    let parsed;
    try {
      parsed = new URL(candidate, 'https://srizony.invalid');
    } catch {
      continue;
    }

    // Do not interpret the application's /api/media/{database-id} route as an
    // object key. Only extract keys from known S3 bucket URL path segments.
    const match = parsed.pathname.match(/(?:^|\/)(?:uploads|public-assets)\/(media\/.+)$/i);
    if (!match) continue;

    let key;
    try {
      key = match[1].split('/').map((part) => decodeURIComponent(part)).join('/');
    } catch {
      continue;
    }
    if (isSafeMediaKey(key)) return key;
  }
  return '';
}

export function isSafeMediaKey(key) {
  return typeof key === 'string'
    && key.startsWith('media/')
    && !key.startsWith('/')
    && !key.includes('\\')
    && !key.split('/').some((part) => !part || part === '.' || part === '..');
}

/** Resolve project-owned public assets only; never permit paths outside /public. */
export function resolveProjectPublicAssetPath(src, projectRoot = process.cwd()) {
  const raw = typeof src === 'string' ? src.trim() : '';
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;

  let pathname;
  try {
    const parsed = new URL(raw, 'https://srizony.invalid');
    if (parsed.origin !== 'https://srizony.invalid') return null;
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  if (!/^\/(?:photos|images)\//i.test(pathname)) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((part) => part === '.' || part === '..' || part.includes('\\') || part.includes('\0'))) return null;

  const publicRoot = path.resolve(projectRoot, 'public');
  const assetPath = path.resolve(publicRoot, ...segments);
  const rel = path.relative(publicRoot, assetPath);
  if (!rel || rel.startsWith(`..${path.sep}`) || rel === '..' || path.isAbsolute(rel)) return null;
  return assetPath;
}

export function parseApprovedRemoteImageUrl(src, hosts = allowedRemoteImageHosts()) {
  let url;
  try {
    url = new URL(String(src || ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.has(url.hostname.toLowerCase())) return null;
  return url;
}

export function classifyImageSource(row, options = {}) {
  const objectKey = resolveObjectStorageKey(row?.storage_key, row?.src);
  if (objectKey) return { type: 'object-storage', key: objectKey };

  const localPath = resolveProjectPublicAssetPath(row?.src, options.projectRoot || process.cwd());
  if (localPath) return { type: 'project-public', path: localPath, src: String(row.src) };

  const remoteUrl = parseApprovedRemoteImageUrl(row?.src, options.allowedHosts || allowedRemoteImageHosts());
  if (remoteUrl) return { type: 'approved-remote', url: remoteUrl };

  return { type: 'unresolved' };
}

export function createBackupStorageKey(id, src, contentType) {
  const rawId = String(id ?? 'unknown').replace(/[^0-9]/g, '') || 'unknown';
  const digest = createHash('sha256').update(`${String(id)}\n${String(src)}`).digest('hex').slice(0, 20);
  const extension = MIME_EXTENSIONS[String(contentType || '').toLowerCase()] || 'bin';
  return `media/drive-backup/${rawId}-${digest}.${extension}`;
}

async function readResponseBodyLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error(`Remote image exceeds the ${maxBytes}-byte backup limit.`);
  if (!response.body) throw new Error('Remote image response has no body.');

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`Remote image exceeds the ${maxBytes}-byte backup limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

/** Fetch only explicitly approved HTTPS image hosts, validating each redirect. */
export async function fetchApprovedRemoteImage(src, options = {}) {
  const hosts = options.allowedHosts || allowedRemoteImageHosts();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxBytes = Number(options.maxBytes || 25 * 1024 * 1024);
  const timeoutMs = Number(options.timeoutMs || 25_000);
  let current = parseApprovedRemoteImageUrl(src, hosts);
  if (!current) throw new Error('Remote image URL is not HTTPS or its hostname is not in DRIVE_JSON_IMAGE_FETCH_HOSTS.');

  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const response = await fetchImpl(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml' },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === 4) throw new Error('Remote image exceeded the allowed redirect limit.');
      const redirected = new URL(location, current);
      current = parseApprovedRemoteImageUrl(redirected.toString(), hosts);
      if (!current) throw new Error('Remote image redirect points to a hostname that is not allow-listed.');
      continue;
    }

    if (!response.ok) throw new Error(`Remote image request failed with HTTP ${response.status}.`);
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) throw new Error(`Remote image returned unsupported content type: ${contentType || '(missing)'}.`);
    const data = await readResponseBodyLimited(response, maxBytes);
    if (!data.byteLength) throw new Error('Remote image response was empty.');
    return { data, contentType, finalUrl: current.toString() };
  }
  throw new Error('Remote image redirect handling ended unexpectedly.');
}

export { DEFAULT_REMOTE_IMAGE_HOSTS, MIME_EXTENSIONS, SUPPORTED_IMAGE_TYPES };
