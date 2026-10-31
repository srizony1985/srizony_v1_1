import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { primaryNav, systemData } from '@/lib/cms/fallback-gateway'

if (!db) throw new Error('DATABASE_URL is not configured')

async function seedNavItem(item: any, groupId: number, parentId: number | null, sortOrder: number) {
  const menuType = item.menuType === 'folder' ? 'folder' : item.menuType === 'external' ? 'external' : 'page'
  const href = menuType === 'folder' ? '' : String(item.href || '')
  const existing = menuType === 'folder'
    ? await db!.execute(sql`SELECT id FROM nav_items WHERE group_id = ${groupId} AND parent_id IS NOT DISTINCT FROM ${parentId} AND menu_type = 'folder' AND label_en = ${item.label.en} LIMIT 1`)
    : await db!.execute(sql`SELECT id FROM nav_items WHERE group_id = ${groupId} AND href = ${href} AND COALESCE(menu_type, 'page') = ${menuType} LIMIT 1`)
  const id = Number((existing.rows[0] as any)?.id || 0)
  const result = id
    ? { rows: [{ id }] }
    : await db!.execute(sql`INSERT INTO nav_items(group_id,parent_id,label_en,label_bn,href,featured,sort_order,menu_type) VALUES(${groupId},${parentId},${item.label.en},${item.label.bn},${href},${item.featured ?? false},${sortOrder},${menuType}) RETURNING id`)
  const itemId = Number((result.rows[0] as any).id)
  await db!.execute(sql`UPDATE nav_items SET parent_id = ${parentId}, label_en = ${item.label.en}, label_bn = ${item.label.bn}, href = ${href}, sort_order = ${sortOrder}, menu_type = ${menuType} WHERE id = ${itemId}`)
  for (let i = 0; i < (item.children ?? []).length; i++) await seedNavItem(item.children[i], groupId, itemId, i)
}

async function main() {
  await db?.execute(sql`
    CREATE TABLE IF NOT EXISTS pages (
      id BIGSERIAL PRIMARY KEY,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'published',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS render_cache JSONB`)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS subtitle_en TEXT`)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS subtitle_bn TEXT`)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS hero_image_id BIGINT`)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS hero_tone VARCHAR(20)`)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description_en TEXT`)
  await db?.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description_bn TEXT`)

  await db?.execute(sql`CREATE TABLE IF NOT EXISTS nav_groups (id BIGSERIAL PRIMARY KEY, key VARCHAR(120) NOT NULL UNIQUE, label_en TEXT NOT NULL, label_bn TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)`)
  await db?.execute(sql`CREATE TABLE IF NOT EXISTS nav_items (id BIGSERIAL PRIMARY KEY, group_id BIGINT NOT NULL REFERENCES nav_groups(id) ON DELETE CASCADE, parent_id BIGINT REFERENCES nav_items(id) ON DELETE CASCADE, label_en TEXT NOT NULL, label_bn TEXT NOT NULL, href TEXT NOT NULL, featured BOOLEAN NOT NULL DEFAULT false, sort_order INTEGER NOT NULL DEFAULT 0)`)
  await db?.execute(sql`CREATE TABLE IF NOT EXISTS site_global_state (id SMALLINT PRIMARY KEY CHECK (id = 1), value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
  const navResult = await db?.execute(sql`SELECT COUNT(*)::int AS count FROM nav_groups`)
  const navCount = Number(navResult?.rows[0]?.count ?? 0)
  if (navCount === 0) {
    const r = await db!.execute(sql`INSERT INTO nav_groups(key,label_en,label_bn,sort_order) VALUES('primary','Site Navigation','সাইট নেভিগেশন',0) ON CONFLICT(key) DO UPDATE SET label_en=EXCLUDED.label_en,label_bn=EXCLUDED.label_bn RETURNING id`)
    const gid = Number((r.rows[0] as any).id)
    for (let i = 0; i < primaryNav.length; i++) await seedNavItem(primaryNav[i], gid, null, i)
  }
  const globalExists = await db?.execute(sql`SELECT 1 FROM site_global_state WHERE id = 1 LIMIT 1`)
  if (!globalExists?.rows.length) await db?.execute(sql`INSERT INTO site_global_state(id,value,updated_at) VALUES(1,${JSON.stringify(systemData)}::jsonb,now())`)
  await db?.execute(sql`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(64) NOT NULL UNIQUE,
      amount NUMERIC(12,2) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      donor JSONB,
      receipt_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await db?.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ`)
  await db?.execute(sql`CREATE INDEX IF NOT EXISTS donations_created_idx ON donations(created_at DESC)`)

  // Older databases created this table with related_entry_id instead of the
  // current related_slug contract. Keep the repair non-destructive; the seed
  // command can detect and use either shape.
  const relatedColumns = await db?.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'content_entry_related'
      AND column_name IN ('related_slug', 'related_entry_id')
  `)
  if (!relatedColumns?.rows.length) {
    await db?.execute(sql`
      CREATE TABLE IF NOT EXISTS content_entry_related (
        content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
        related_slug VARCHAR(255) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(content_entry_id, related_slug)
      )
    `)
  }

  console.log('Safe CMS repair complete. No existing rows were truncated or overwritten.')
}

main().catch((error) => { console.error(error); process.exit(1) })