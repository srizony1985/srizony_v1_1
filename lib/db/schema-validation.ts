import { sql } from 'drizzle-orm'
import type { db } from '@/lib/db'

type DatabaseExecutor = Pick<NonNullable<typeof db>, 'execute'>

type RequiredColumns = Record<string, readonly string[]>

/** Read-only guard shared by runtime modules. Only migrations may change the schema. */
export async function assertRequiredColumns(
  database: DatabaseExecutor,
  required: RequiredColumns,
  scope: string,
): Promise<void> {
  const tables = Object.keys(required)
  if (tables.length === 0) return

  const tableList = sql.join(tables.map((table) => sql`${table}`), sql`, `)
  const result = await database.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (${tableList})
  `)

  const found = new Map<string, Set<string>>()
  for (const row of result.rows as Array<{ table_name: string; column_name: string }>) {
    const tableName = String(row.table_name)
    const columns = found.get(tableName) ?? new Set<string>()
    columns.add(String(row.column_name))
    found.set(tableName, columns)
  }

  const missing = Object.entries(required).flatMap(([table, columns]) =>
    columns.filter((column) => !found.get(table)?.has(column)).map((column) => `${table}.${column}`),
  )

  if (missing.length) {
    const preview = missing.slice(0, 30).join(', ')
    throw new Error(
      `${scope} database schema is incomplete (${preview}${missing.length > 30 ? ', …' : ''}). ` +
      'Runtime requests do not create or repair tables. Back up the database, then apply the committed migrations with npm run db:init.',
    )
  }
}

