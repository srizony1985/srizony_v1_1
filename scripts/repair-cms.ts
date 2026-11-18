import './load-env'
import type { NavItem } from '../types/entityType'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { primaryNav, systemData } from '@/lib/cms/fallback-gateway'

if (!db) throw new Error('DATABASE_URL is not configured')

async function seedNavItem(item: NavItem, groupId: number, parentId: number | null, sortOrder: number) {
  const menuType = item.menuType === 'folder' ? 'folder' : item.menuType === 'external' ? 'external' : 'page'
  const href = menuType === 'folder' ? '' : String(item.href || '')
  const existing = menuType === 'folder'
    ? await db!.execute(sql`SELECT id FROM nav_items WHERE group_id = ${groupId} AND parent_id IS NOT DISTINCT FROM ${parentId} AND menu_type = 'folder' AND label_en = ${item.label.en} LIMIT 1`)
    : await db!.execute(sql`SELECT id FROM nav_items WHERE group_id = ${groupId} AND href = ${href} AND COALESCE(menu_type, 'page') = ${menuType} LIMIT 1`)
  const id = Number((existing.rows[0] as Record<string, unknown>)?.id || 0)
  const result = id
    ? { rows: [{ id }] }
    : await db!.execute(sql`INSERT INTO nav_items(group_id,parent_id,label_en,label_bn,href,featured,sort_order,menu_type) VALUES(${groupId},${parentId},${item.label.en},${item.label.bn},${href},${item.featured ?? false},${sortOrder},${menuType}) RETURNING id`)
  const itemId = Number((result.rows[0] as Record<string, unknown>).id)
  await db!.execute(sql`UPDATE nav_items SET parent_id = ${parentId}, label_en = ${item.label.en}, label_bn = ${item.label.bn}, href = ${href}, sort_order = ${sortOrder}, menu_type = ${menuType} WHERE id = ${itemId}`)
  const children = item.children ?? []
  for (let i = 0; i < children.length; i++) await seedNavItem(children[i], groupId, itemId, i)
}

async function main() {
  // This script seeds CMS data only. Schema creation and repair are exclusively
  // handled by the ordered Drizzle migrations.
  await ensureCmsSchema()

  const navResult = await db!.execute(sql`SELECT COUNT(*)::int AS count FROM nav_groups`)
  const navCount = Number(navResult.rows[0]?.count ?? 0)
  if (navCount === 0) {
    const r = await db!.execute(sql`
      INSERT INTO nav_groups(key,label_en,label_bn,sort_order)
      VALUES('primary','Site Navigation','সাইট নেভিগেশন',0)
      ON CONFLICT(key) DO UPDATE
      SET label_en=EXCLUDED.label_en,label_bn=EXCLUDED.label_bn
      RETURNING id
    `)
    const groupId = Number((r.rows[0] as Record<string, unknown>).id)
    for (let i = 0; i < primaryNav.length; i++) {
      await seedNavItem(primaryNav[i], groupId, null, i)
    }
  }

  const globalExists = await db!.execute(sql`SELECT 1 FROM site_global_state WHERE id = 1 LIMIT 1`)
  if (!globalExists.rows.length) {
    await db!.execute(sql`
      INSERT INTO site_global_state(id,value,updated_at)
      VALUES(1,${JSON.stringify(systemData)}::jsonb,now())
    `)
  }

  const relatedColumns = await db!.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_entry_related'
      AND column_name IN ('related_slug', 'related_entry_id')
  `)
  const relatedColumnNames = new Set(
    relatedColumns.rows.map((row) => String((row as Record<string, unknown>).column_name)),
  )
  if (!relatedColumnNames.has('related_slug')) {
    throw new Error(
      'content_entry_related.related_slug is missing. Apply the committed migrations before running db:repair; this script no longer creates or alters tables.',
    )
  }

  console.log('CMS data repair complete. Schema was validated read-only; existing rows were not truncated or overwritten.')
}

main().catch((error) => { console.error(error); process.exit(1) })