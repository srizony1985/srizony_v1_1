import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  allowedRemoteImageHosts,
  classifyImageSource,
  createBackupStorageKey,
  fetchApprovedRemoteImage,
  isSafeMediaKey,
  parseApprovedRemoteImageUrl,
  resolveObjectStorageKey,
  resolveProjectPublicAssetPath,
} from '../scripts/lib/media-source.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('resolves canonical object-storage keys from metadata and legacy S3 URLs', () => {
  assert.equal(resolveObjectStorageKey('media/2026/11/asset.jpg', null), 'media/2026/11/asset.jpg');
  assert.equal(resolveObjectStorageKey(null, 'https://storage.example/uploads/media/2026/11/asset%20one.jpg'), 'media/2026/11/asset one.jpg');
  assert.equal(resolveObjectStorageKey(null, '/api/media/16'), '');
  assert.equal(isSafeMediaKey('media/2026/11/a.jpg'), true);
  assert.equal(isSafeMediaKey('media/../secret'), false);
});

test('resolves local /photos and /images assets inside the project public directory only', () => {
  const photos = resolveProjectPublicAssetPath('/photos/school-children.jpg', root);
  assert.equal(photos, path.join(root, 'public', 'photos', 'school-children.jpg'));
  assert.equal(resolveProjectPublicAssetPath('/images/not-a-real-file.png', root), path.join(root, 'public', 'images', 'not-a-real-file.png'));
  assert.equal(resolveProjectPublicAssetPath('/api/media/16', root), null);
  assert.equal(resolveProjectPublicAssetPath('https://images.unsplash.com/photo.jpg', root), null);
  assert.equal(resolveProjectPublicAssetPath('/photos/%2e%2e%2f..%2f.env', root), null);
});

test('project public image references resolve to readable project files', async () => {
  const source = classifyImageSource({ storage_key: null, src: '/photos/school-children.jpg' }, { projectRoot: root, allowedHosts: allowedRemoteImageHosts() });
  assert.equal(source.type, 'project-public');
  const bytes = await readFile(source.path);
  assert.ok(bytes.byteLength > 0);
});

test('classifies known project and seeded remote image sources', () => {
  const hosts = allowedRemoteImageHosts();
  assert.equal(classifyImageSource({ storage_key: null, src: '/photos/school-children.jpg' }, { projectRoot: root, allowedHosts: hosts }).type, 'project-public');
  assert.equal(classifyImageSource({ storage_key: null, src: 'https://images.unsplash.com/photo-123?auto=format' }, { projectRoot: root, allowedHosts: hosts }).type, 'approved-remote');
  assert.equal(classifyImageSource({ storage_key: null, src: 'https://api.dicebear.com/9.x/initials/svg?seed=SF' }, { projectRoot: root, allowedHosts: hosts }).type, 'approved-remote');
  assert.equal(classifyImageSource({ storage_key: null, src: 'https://untrusted.example/image.png' }, { projectRoot: root, allowedHosts: hosts }).type, 'unresolved');
});

test('remote image allowlist requires HTTPS and exact approved hostnames', () => {
  const hosts = allowedRemoteImageHosts('assets.example.org');
  assert.equal(parseApprovedRemoteImageUrl('https://assets.example.org/image.png', hosts).hostname, 'assets.example.org');
  assert.equal(parseApprovedRemoteImageUrl('http://images.unsplash.com/image.jpg', hosts), null);
  assert.equal(parseApprovedRemoteImageUrl('https://evil-images.unsplash.com/image.jpg', hosts), null);
  assert.equal(parseApprovedRemoteImageUrl('https://127.0.0.1/image.png', hosts), null);
});

test('approved remote fetch copies image bytes and validates content type', async () => {
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const result = await fetchApprovedRemoteImage('https://images.unsplash.com/image.jpg', {
    fetchImpl: async () => new Response(imageBytes, { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': String(imageBytes.length) } }),
  });
  assert.deepEqual(result.data, imageBytes);
  assert.equal(result.contentType, 'image/jpeg');
});

test('approved remote fetch revalidates redirect destinations', async () => {
  let calls = 0;
  await assert.rejects(() => fetchApprovedRemoteImage('https://images.unsplash.com/image.jpg', {
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data' } });
    },
  }), /redirect points to a hostname that is not allow-listed/);
  assert.equal(calls, 1);
});

test('approved remote fetch enforces a byte limit', async () => {
  const data = Buffer.alloc(64, 1);
  await assert.rejects(() => fetchApprovedRemoteImage('https://images.unsplash.com/image.jpg', {
    maxBytes: 32,
    fetchImpl: async () => new Response(data, { status: 200, headers: { 'content-type': 'image/jpeg' } }),
  }), /exceeds the 32-byte backup limit/);
});

test('snapshot-only backup storage key is deterministic and path-safe', () => {
  const a = createBackupStorageKey('16', 'https://images.unsplash.com/photo.jpg', 'image/jpeg');
  const b = createBackupStorageKey('16', 'https://images.unsplash.com/photo.jpg', 'image/jpeg');
  assert.equal(a, b);
  assert.match(a, /^media\/drive-backup\/16-[a-f0-9]{20}\.jpg$/);
  assert.equal(isSafeMediaKey(a), true);
});
