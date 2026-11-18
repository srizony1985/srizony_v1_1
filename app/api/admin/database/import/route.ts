import type { ExternalValue, JsonObject } from '@/types/json'
import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { sql } from 'drizzle-orm'
import { Pool } from '@neondatabase/serverless'
import { drizzle as drizzleNeonWs } from 'drizzle-orm/neon-serverless'
import { db, withDbRetry } from '@/lib/db'
import { requireAdmin, failure } from '@/lib/cms/guard'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { CMS_TRANSFER_FORMAT, CMS_TRANSFER_MAX_BYTES, CMS_TRANSFER_MAX_ROWS_PER_TABLE, CMS_TRANSFER_TABLES, CMS_TRANSFER_VERSION, quoteIdentifier } from '@/lib/cms/dataTransfer'
import { CONTENT_COLLECTION_ROUTES, FIXED_CONTENT_PARENT, type ContentComponent } from '@/lib/cms/components'
import { auditAdminAction } from '@/lib/security'
import { readBoundedRequestText } from '@/lib/securityPrimitives.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isPlainObject(value: ExternalValue): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

export async function POST(req: Request) {
  const guard = await requireAdmin('admin')
  if (guard.denied) return guard.denied
  const database = db
  if (database === null) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  const raw = await readBoundedRequestText(req, CMS_TRANSFER_MAX_BYTES)
  if (raw === null) return NextResponse.json({ error: 'JSON file exceeds the 20 MB import limit or is not valid UTF-8.' }, { status: 413 })
  let payload: JsonObject
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'The selected file is not valid JSON.' }, { status: 400 }) }
  if (!isPlainObject(payload) || payload.format !== CMS_TRANSFER_FORMAT || payload.version !== CMS_TRANSFER_VERSION || !isPlainObject(payload.data)) {
    return NextResponse.json({ error: 'Unsupported file. Select an Srizony CMS site-data JSON export (format version 1).' }, { status: 400 })
  }
  const allowed = new Set<string>(CMS_TRANSFER_TABLES)
  const requestedTables = Object.keys(payload.data)
  const unsupported = requestedTables.filter((table) => !allowed.has(table))
  if (unsupported.length) return NextResponse.json({ error: `The file contains unsupported tables: ${unsupported.join(', ')}.` }, { status: 400 })
  for (const table of requestedTables) {
    const rows = payload.data[table]
    if (!Array.isArray(rows) || rows.length > CMS_TRANSFER_MAX_ROWS_PER_TABLE || !rows.every(isPlainObject)) {
      return NextResponse.json({ error: `The ${table} dataset must be an array of no more than ${CMS_TRANSFER_MAX_ROWS_PER_TABLE} records.` }, { status: 400 })
    }
    if (table === 'site_settings' && rows.some((row: JsonObject) => typeof row.key !== 'string' || !/^cms-document:[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(row.key))) {
      return NextResponse.json({ error: 'Only named cms-document JSON records may be imported from site_settings. Operational and demo-backup keys are excluded.' }, { status: 400 })
    }
  }

  // Optional, explicit collection-page setup for CMS content imports. This is
  // deliberately opt-in so ordinary exports never re-enable a collection that
  // an administrator intentionally disabled in Page Builder.
  const setupContentCollections: ContentComponent[] = []
  if (payload.setupContentCollections !== undefined) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Demo collection setup is disabled in production. Use a local or staging environment.' }, { status: 403 })
    }
    if (process.env.ALLOW_UI_DEMO_IMPORT !== 'YES_DEMO_ONLY') {
      return NextResponse.json({ error: 'Set ALLOW_UI_DEMO_IMPORT=YES_DEMO_ONLY in the local environment to enable the demo dataset import.' }, { status: 403 })
    }
    const rawComponents = payload.setupContentCollections
    if (!Array.isArray(rawComponents) || rawComponents.length > CONTENT_COLLECTION_ROUTES.length || !rawComponents.every((value) => typeof value === 'string')) {
      return NextResponse.json({ error: 'setupContentCollections must be a list of supported CMS component keys.' }, { status: 400 })
    }
    const importedContent = payload.data.cms_content_items
    if (!Array.isArray(importedContent) || !importedContent.length || !importedContent.every(isPlainObject)) {
      return NextResponse.json({ error: 'Collection setup requires valid cms_content_items records in the same JSON file.' }, { status: 400 })
    }
    const importedContentRows = importedContent.filter(isPlainObject)
    const seenComponents = new Set<string>()
    for (const value of rawComponents) {
      const component = String(value)
      if (seenComponents.has(component)) return NextResponse.json({ error: `Duplicate collection component: ${component}.` }, { status: 400 })
      seenComponents.add(component)
      if (!CONTENT_COLLECTION_ROUTES.some((route) => route.component === component)) {
        return NextResponse.json({ error: `Unsupported CMS collection component: ${component}.` }, { status: 400 })
      }
      if (!importedContentRows.some((row) => row.component === component)) {
        return NextResponse.json({ error: `The file requests a ${component} collection but contains no ${component} records.` }, { status: 400 })
      }
      // Prevent an arbitrary content transfer file from silently changing page
      // layouts. The extra collection setup contract is reserved for clearly
      // namespaced demo records carrying the dataset safety marker.
      const componentRows = importedContentRows.filter((row) => row.component === component)
      if (!componentRows.every((row) => isPlainObject(row.attributes) && row.attributes.demoOnly === true && typeof row.attributes.demoDataset === 'string' && row.attributes.demoDataset.startsWith('srizony-ui-demo-'))) {
        return NextResponse.json({ error: `Collection setup for ${component} is allowed only for marked Srizony UI demo records.` }, { status: 400 })
      }
      setupContentCollections.push(component as ContentComponent)
    }
  }

  try {
    await ensureCmsSchema()

    // Preflight every table, column and primary key before making the first write.
    // This prevents malformed or incompatible files from partially applying simply
    // because an error was discovered late in the import order.
    const tablePlans = new Map<string, {
      rows: JsonObject[]
      columns: Map<string, { column_name: string; data_type: string; udt_name: string; column_default: string | null; is_identity: string }>
      primaryKeys: string[]
      identityPrimaryKey: boolean
      groups: Map<string, { keys: string[]; rows: JsonObject[]; hasPrimaryKey: boolean }>
    }>()

    for (const table of CMS_TRANSFER_TABLES) {
      const rows = payload.data[table] as JsonObject[] | undefined
      if (!rows?.length) {
        if (rows) tablePlans.set(table, { rows, columns: new Map(), primaryKeys: [], identityPrimaryKey: false, groups: new Map() })
        continue
      }

      const columnsResult = await withDbRetry(() => database.execute(sql`
        SELECT column_name, data_type, udt_name, column_default, is_identity
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
        ORDER BY ordinal_position`))
      const columns = new Map((columnsResult.rows as Array<{ column_name: string; data_type: string; udt_name: string; column_default: string | null; is_identity: string }>).map((column) => [column.column_name, column]))
      if (!columns.size) return NextResponse.json({ error: `The destination database does not contain the table ${table}. Run database migrations before importing.` }, { status: 409 })

      const pkResult = await withDbRetry(() => database.execute(sql`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
        WHERE tc.table_schema = 'public' AND tc.table_name = ${table} AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position`))
      const primaryKeys = (pkResult.rows as Array<{ column_name: string }>).map((row) => row.column_name)
      if (!primaryKeys.length) return NextResponse.json({ error: `The destination table ${table} has no primary key; the import was stopped before writing any records.` }, { status: 409 })

      const groups = new Map<string, { keys: string[]; rows: JsonObject[]; hasPrimaryKey: boolean }>()
      const seenKeys = new Set<string>()
      const identityPrimaryKey = primaryKeys.length === 1 && columns.get(primaryKeys[0])?.is_identity === 'YES'
      const generatedPrimaryKey = primaryKeys.length === 1 && (identityPrimaryKey || /nextval\s*\(/i.test(String(columns.get(primaryKeys[0])?.column_default || '')))
      for (const row of rows) {
        const unknownColumns = Object.keys(row).filter((key) => !columns.has(key))
        if (unknownColumns.length) return NextResponse.json({ error: `The ${table} record contains unknown column(s): ${unknownColumns.join(', ')}. Check the export version and destination schema.` }, { status: 400 })
        const hasPrimaryKey = primaryKeys.every((key) => Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== '')
        if (!hasPrimaryKey && !generatedPrimaryKey) {
          return NextResponse.json({ error: `A record in ${table} is missing its primary key (${primaryKeys.join(', ')}), and the table cannot generate one automatically.` }, { status: 400 })
        }
        if (hasPrimaryKey) {
          const identity = JSON.stringify(primaryKeys.map((key) => row[key]))
          if (seenKeys.has(identity)) return NextResponse.json({ error: `The ${table} dataset contains duplicate primary key ${identity}. Remove duplicate rows before importing.` }, { status: 400 })
          seenKeys.add(identity)
        }
        const keys = Object.keys(row).filter((key) => !(primaryKeys.includes(key) && (row[key] === null || row[key] === undefined || row[key] === '')))
        if (!keys.length) return NextResponse.json({ error: `A record in ${table} has no importable values.` }, { status: 400 })
        const groupKey = JSON.stringify([keys, hasPrimaryKey])
        const group = groups.get(groupKey) ?? { keys, rows: [], hasPrimaryKey }
        group.rows.push(row)
        groups.set(groupKey, group)
      }
      tablePlans.set(table, { rows, columns, primaryKeys, identityPrimaryKey, groups })
    }

    const imported: Record<string, number> = {}
    let collectionsConfigured = 0
    const collectionPathsToRevalidate = new Set<string>()
    // The regular application client uses Neon HTTP, whose Drizzle driver does
    // not implement interactive transactions. Use the Neon WebSocket driver for
    // this multi-table mutation so the import is all-or-nothing.
    const connectionString = process.env.DATABASE_URL?.trim()
    if (!connectionString) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
    const transactionPool = new Pool({ connectionString })
    const transactionalDb = drizzleNeonWs({ client: transactionPool })
    try {
      await transactionalDb.transaction(async (tx) => {
        // Import parents before children. Existing records are updated by primary
        // key; records absent from the file are deliberately left untouched.
        for (const table of CMS_TRANSFER_TABLES) {
          const plan = tablePlans.get(table)
          if (!plan) continue
          if (!plan.rows.length) { imported[table] = 0; continue }
          const quotedTable = quoteIdentifier(table)
          const pkSet = new Set(plan.primaryKeys)
          let count = 0

          for (const group of plan.groups.values()) {
            const { keys, rows } = group
            const quotedColumns = keys.map(quoteIdentifier).join(', ')
            // cms_content_items has a stable route-scoped unique key. Demo JSON
            // intentionally omits generated IDs, so use that canonical key for
            // repeatable dashboard uploads instead of inserting duplicates.
            const conflictKeys = group.hasPrimaryKey
              ? plan.primaryKeys
              : table === 'cms_content_items' && ['site_id', 'route_parent', 'slug'].every((key) => keys.includes(key))
                ? ['site_id', 'route_parent', 'slug']
                : []
            const conflictSql = conflictKeys.map(quoteIdentifier).join(', ')
            const conflictSet = new Set(conflictKeys)
            const updates = keys.filter((key) => !conflictSet.has(key) && !pkSet.has(key))
            const updateSql = updates.length
              ? sql`DO UPDATE SET ${sql.join(updates.map((key) => sql`${sql.raw(quoteIdentifier(key))} = EXCLUDED.${sql.raw(quoteIdentifier(key))}`), sql`, `)}`
              : sql`DO NOTHING`

            // Batch rows of an identical shape while retaining one DB transaction
            // across all tables and all chunks.
            for (let offset = 0; offset < rows.length; offset += 100) {
              const chunk = rows.slice(offset, offset + 100)
              const tuples = chunk.map((row) => sql`(${sql.join(keys.map((key) => {
                const info = plan.columns.get(key)!
                const value = row[key]
                return info.data_type === 'json' || info.data_type === 'jsonb'
                  ? sql`${JSON.stringify(value ?? null)}::${sql.raw(info.data_type)}`
                  : sql`${value === undefined ? null : value}`
              }), sql`, `)})`)
              const valuesSql = sql.join(tuples, sql`, `)
              const identityOverride = group.hasPrimaryKey && plan.identityPrimaryKey ? sql`OVERRIDING SYSTEM VALUE` : sql``
              const query = conflictKeys.length
                ? sql`INSERT INTO ${sql.raw(quotedTable)} (${sql.raw(quotedColumns)}) ${identityOverride} VALUES ${valuesSql} ON CONFLICT (${sql.raw(conflictSql)}) ${updateSql}`
                : sql`INSERT INTO ${sql.raw(quotedTable)} (${sql.raw(quotedColumns)}) VALUES ${valuesSql}`
              await tx.execute(query)
              count += chunk.length
            }
          }
          imported[table] = count
        }

        // Keep serial/identity counters above imported IDs within the same commit.
        for (const table of Object.keys(imported)) {
          if (!imported[table]) continue
          const plan = tablePlans.get(table)
          const idType = plan?.columns.get('id')?.data_type
          if (!plan || !['integer', 'bigint', 'smallint'].includes(idType || '')) continue
          const qualifiedTable = quoteIdentifier(table)
          const relationName = `public.${table}`
          await tx.execute(sql`
            SELECT CASE
              WHEN pg_get_serial_sequence(${relationName}, 'id') IS NOT NULL THEN
                setval(
                  pg_get_serial_sequence(${relationName}, 'id'),
                  GREATEST(COALESCE((SELECT MAX(id)::bigint FROM ${sql.raw(qualifiedTable)}), 1), 1),
                  EXISTS(SELECT 1 FROM ${sql.raw(qualifiedTable)})
                )
              ELSE NULL
            END`)
        }

        // Attach one contentFeed section per explicitly requested CMS component.
        // This makes a single JSON upload sufficient for both CMS records and
        // public collection/detail routes without rewriting existing page layouts.
        for (const component of setupContentCollections) {
          const route = CONTENT_COLLECTION_ROUTES.find((item) => item.component === component)
          if (!route) continue
          const destinationPage = FIXED_CONTENT_PARENT[component] || route.slug
          const headingByComponent: Record<ContentComponent, { en: string; bn: string }> = {
            project: { en: 'Projects', bn: 'প্রকল্পসমূহ' },
            news: { en: 'Latest News', bn: 'সর্বশেষ সংবাদ' },
            enterprise: { en: 'Enterprises', bn: 'উদ্যোগসমূহ' },
            'partner-agency': { en: 'Partner Agencies', bn: 'অংশীদার সংস্থা' },
            'health-service': { en: 'Health Services', bn: 'স্বাস্থ্যসেবা' },
            'loan-product': { en: 'Loan Products', bn: 'ঋণ পণ্য' },
            product: { en: 'Products & Services', bn: 'পণ্য ও সেবা' },
            team: { en: 'Our Team', bn: 'আমাদের টিম' },
            notice: { en: 'Notices', bn: 'নোটিশ' },
            report: { en: 'Reports', bn: 'প্রতিবেদন' },
            job: { en: 'Current Vacancies', bn: 'চলমান চাকরির সুযোগ' },
            'success-story': { en: 'Success Stories', bn: 'সাফল্যের গল্প' },
            stat: { en: 'Our Impact', bn: 'আমাদের প্রভাব' },
          }
          const pageResult = await tx.execute(sql`
            SELECT slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order
            FROM pages WHERE slug = ${destinationPage} LIMIT 1`)
          let pageRow = pageResult.rows[0] as Record<string, ExternalValue> | undefined
          if (!pageRow) {
            const initialSection = {
              type: 'contentFeed', visible: true, heading: headingByComponent[component],
              components: [component], items: [],
              contentCollection: { enabled: true, component, maxItems: 12, layout: 'grid', columns: 3, gap: 24, viewportItems: 3 },
            }
            const initialCache = {
              slug: destinationPage, title: route.title, subtitle: route.subtitle,
              status: 'published', sortOrder: 0, sections: [initialSection],
            }
            await tx.execute(sql`
              INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at)
              VALUES (${destinationPage}, ${route.title.en}, ${route.title.bn}, ${route.subtitle.en}, ${route.subtitle.bn}, ${JSON.stringify(initialCache)}::jsonb, 'published', 0, now())
              ON CONFLICT (slug) DO NOTHING`)
            const createdPage = await tx.execute(sql`
              SELECT slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order
              FROM pages WHERE slug = ${destinationPage} LIMIT 1`)
            pageRow = createdPage.rows[0] as Record<string, ExternalValue> | undefined
          }
          if (!pageRow) throw new Error(`Unable to prepare the ${component} collection page (${destinationPage}).`)

          const rawCache = pageRow.render_cache && typeof pageRow.render_cache === 'object' && !Array.isArray(pageRow.render_cache)
            ? pageRow.render_cache as JsonObject
            : {}
          const sections = Array.isArray(rawCache.sections)
            ? rawCache.sections.filter((section): section is JsonObject => isPlainObject(section))
            : []
          const sectionIndex = sections.findIndex((section) => {
            const collection = isPlainObject(section.contentCollection) ? section.contentCollection : null
            const sectionComponents = Array.isArray(section.components) ? section.components : []
            return collection?.component === component || (section.type === 'contentFeed' && sectionComponents[0] === component)
          })
          if (sectionIndex >= 0) {
            const current = sections[sectionIndex]
            const collection = isPlainObject(current.contentCollection) ? current.contentCollection : null
            // Respect an explicit administrator decision to disable this collection.
            if (collection?.enabled === false) {
              collectionPathsToRevalidate.add(destinationPage)
              continue
            }
            if (current.type === 'contentFeed' && !collection) {
              sections[sectionIndex] = {
                ...current,
                components: [component],
                contentCollection: { enabled: true, component, maxItems: 12, layout: 'grid', columns: Number(current.columns) || 3, gap: 24, viewportItems: 3 },
              }
            }
          } else {
            const feedSection = {
              type: 'contentFeed', visible: true, heading: headingByComponent[component],
              components: [component], items: [], columns: 3,
              contentCollection: { enabled: true, component, maxItems: 12, layout: 'grid', columns: 3, gap: 24, viewportItems: 3 },
            }
            const legacyCareerIndex = destinationPage === '/carrer-job'
              ? sections.findIndex((section) => {
                  const heading = isPlainObject(section.heading) ? section.heading.en : ''
                  return section.type === 'noticeList' && typeof heading === 'string' && /career|job|open opportunities|current vacancies/i.test(heading)
                })
              : -1
            if (legacyCareerIndex >= 0) sections[legacyCareerIndex] = feedSection
            else sections.push(feedSection)
          }
          const nextCache: JsonObject = {
            ...rawCache,
            slug: destinationPage,
            title: rawCache.title ?? { en: String(pageRow.title_en || route.title.en), bn: String(pageRow.title_bn || route.title.bn) },
            subtitle: rawCache.subtitle ?? { en: String(pageRow.subtitle_en || route.subtitle.en), bn: String(pageRow.subtitle_bn || route.subtitle.bn) },
            sections,
            status: String(pageRow.status || 'published'),
          }
          await tx.execute(sql`UPDATE pages SET render_cache = ${JSON.stringify(nextCache)}::jsonb, updated_at = now() WHERE slug = ${destinationPage}`)
          collectionPathsToRevalidate.add(destinationPage)
          collectionsConfigured += 1
        }
      })
    } finally {
      await transactionPool.end()
    }

    // Make updated pages and content visible without waiting for the regular cache TTL.
    revalidatePath('/', 'layout')
    for (const collectionPath of collectionPathsToRevalidate) {
      revalidatePath(collectionPath)
      revalidatePath(`/bn${collectionPath}`)
    }
    revalidateTag('site-content', 'max')

    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'database.cms_import', entity: 'cms_site_data', metadata: { sourceVersion: payload.version, tables: Object.keys(imported).length, records: Object.values(imported).reduce((total, count) => total + count, 0), collectionsConfigured }, request: req })
    return NextResponse.json({ ok: true, imported, collectionsConfigured, mode: 'merge-upsert', message: 'CMS site data imported. Requested content collections were configured. Records absent from this file were not deleted.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to import CMS site data.') }
}
