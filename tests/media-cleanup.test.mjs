import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { allowedRemoteImageHosts } from '../scripts/lib/media-source.mjs';
import { buildUnrecoverableMediaPlan, getDeleteBlockers, summarizeDeleteEffects } from '../scripts/lib/media-cleanup.mjs';

const hosts = allowedRemoteImageHosts();

test('only ready image rows with no recoverable source become cleanup candidates', async () => {
  const plan = await buildUnrecoverableMediaPlan([
    { id: '16', src: '/api/media/16', storage_key: null, kind: 'image', content_type: 'image/jpeg', status: 'ready' },
    { id: '17', src: 'https://images.unsplash.com/photo-123', storage_key: null, kind: 'image', content_type: 'image/jpeg', status: 'ready' },
    { id: '18', src: '/api/media/18', storage_key: null, kind: 'image', content_type: 'image/jpeg', status: 'deleted' },
    { id: '19', src: '/api/media/19', storage_key: null, kind: 'document', content_type: 'application/pdf', status: 'ready' },
  ], { projectRoot: process.cwd(), allowedHosts: hosts });
  assert.deepEqual(plan.candidates.map((row) => row.id), ['16']);
  assert.equal(plan.keep.some((row) => row.id === '17'), true);
  assert.equal(plan.keep.some((row) => row.id === '18'), true);
  assert.equal(plan.keep.some((row) => row.id === '19'), true);
});

test('does not delete HTTPS media from an unapproved host; reports manual review', async () => {
  const plan = await buildUnrecoverableMediaPlan([
    { id: '20', src: 'https://cdn.customer.example/image.jpg?signature=secret', storage_key: null, kind: 'image', content_type: 'image/jpeg', status: 'ready' },
  ], { projectRoot: process.cwd(), allowedHosts: hosts });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.manualReview.length, 1);
  assert.equal(plan.manualReview[0].src, 'https://cdn.customer.example/image.jpg');
});

test('keeps project public assets that exist and marks missing ones for cleanup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sf-media-clean-'));
  try {
    await mkdir(path.join(root, 'public', 'photos'), { recursive: true });
    await writeFile(path.join(root, 'public', 'photos', 'exists.jpg'), 'image');
    const plan = await buildUnrecoverableMediaPlan([
      { id: '21', src: '/photos/exists.jpg', storage_key: null, kind: 'image', status: 'ready' },
      { id: '22', src: '/photos/missing.jpg', storage_key: null, kind: 'image', status: 'ready' },
    ], { projectRoot: root, allowedHosts: hosts });
    assert.deepEqual(plan.candidates.map((row) => row.id), ['22']);
    assert.equal(plan.keep.some((row) => row.id === '21'), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('restrictive and no-action references block row deletion', () => {
  const blockers = getDeleteBlockers([
    { table: 'public.hero_slides', columns: ['image_id'], count: 1, deleteAction: 'r', constraint: 'hero_slide_image_fk' },
    { table: 'public.pages', columns: ['hero_image_id'], count: 2, deleteAction: 'n', constraint: 'pages_hero_fk' },
    { table: 'public.gallery_items', columns: ['media_id'], count: 3, deleteAction: 'c', constraint: 'gallery_media_fk' },
    { table: 'public.nav_items', columns: ['image_id'], count: 0, deleteAction: 'a', constraint: 'nav_image_fk' },
  ]);
  assert.deepEqual(blockers.map((item) => item.table), ['public.hero_slides']);
});

test('reports the cascade and set-null effects for safe deletes', () => {
  const effects = summarizeDeleteEffects([
    { table: 'public.pages', columns: ['hero_image_id'], count: 2, deleteAction: 'n', constraint: 'pages_hero_fk' },
    { table: 'public.gallery_items', columns: ['media_id'], count: 3, deleteAction: 'c', constraint: 'gallery_media_fk' },
  ]);
  assert.deepEqual(effects.map((item) => item.effect), ['set-null', 'cascade-delete']);
});
