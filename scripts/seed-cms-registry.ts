import './load-env'
import { Pool } from '@neondatabase/serverless'
import { COMPONENTS, CONTENT_COLLECTION_ROUTES } from '@/lib/cms/components'

type RegistryRow = Record<string, unknown>

const databaseUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '').trim()
if (!databaseUrl) {
  throw new Error('DATABASE_URL or BACKUP_DATABASE_URL is not configured.')
}

async function main() {
  const siteKey = (process.env.CMS_SITE_KEY || 'default').trim().slice(0, 120) || 'default'
  const pool = new Pool({ connectionString: databaseUrl, max: 1 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const siteResult = await client.query(
      'SELECT id FROM public.cms_sites WHERE site_key = $1 LIMIT 1',
      [siteKey],
    )
    const site = siteResult.rows[0] as RegistryRow | undefined
    if (!site?.id) {
      throw new Error(`CMS site "${siteKey}" does not exist. Restore or configure cms_sites before seeding the registry.`)
    }
    const siteId = Number(site.id)
    if (!Number.isSafeInteger(siteId) || siteId <= 0) {
      throw new Error(`CMS site "${siteKey}" returned an invalid id.`)
    }

    let insertedTypes = 0
    let insertedFields = 0
    for (const [index, definition] of Object.values(COMPONENTS).entries()) {
      const route = CONTENT_COLLECTION_ROUTES.find((item) => item.component === definition.key)
      const fields = definition.fields.map((field, fieldIndex) => ({ ...field, sortOrder: fieldIndex }))
      const typeResult = await client.query(
        `INSERT INTO public.cms_content_type_definitions(
          site_id, component_key, label, plural_label, description,
          collection_path, detail_path_pattern, fields_schema, capabilities,
          enabled, sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,true,$10)
        ON CONFLICT (site_id, component_key) DO NOTHING
        RETURNING id`,
        [
          siteId, definition.key, definition.label, definition.plural, definition.description,
          route?.slug ?? null, route ? `${route.slug}/:slug` : null,
          JSON.stringify(fields), JSON.stringify({ searchable: true, filterable: true, publishable: true }), index,
        ],
      )
      insertedTypes += typeResult.rowCount ?? 0

      for (let fieldIndex = 0; fieldIndex < definition.fields.length; fieldIndex += 1) {
        const field = definition.fields[fieldIndex]
        const fieldResult = await client.query(
          `INSERT INTO public.cms_content_field_definitions(
            site_id, component_key, field_key, label, field_type, localized,
            required, options, validation, help_text, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
          ON CONFLICT (site_id, component_key, field_key) DO NOTHING
          RETURNING id`,
          [
            siteId, definition.key, field.key, field.label, field.type,
            Boolean(field.bilingual), Boolean(field.required), JSON.stringify(field.options ?? []),
            JSON.stringify({ max: field.max ?? null }), field.help ?? null, fieldIndex,
          ],
        )
        insertedFields += fieldResult.rowCount ?? 0
      }
    }

    const counts = await client.query(
      `SELECT
        (SELECT count(*)::int FROM public.cms_content_type_definitions WHERE site_id = $1) AS content_types,
        (SELECT count(*)::int FROM public.cms_content_field_definitions WHERE site_id = $1) AS content_fields`,
      [siteId],
    )
    const totals = counts.rows[0] as RegistryRow | undefined
    await client.query('COMMIT')
    console.log(`CMS registry ready for site "${siteKey}" (id=${siteId}).`)
    console.log(`Inserted ${insertedTypes} content types and ${insertedFields} field definitions; existing custom definitions were preserved.`)
    console.log(`Current totals: ${Number(totals?.content_types ?? 0)} content types, ${Number(totals?.content_fields ?? 0)} fields.`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('CMS registry seed failed:', error)
  process.exitCode = 1
})
