/** Typed metadata returned by PostgreSQL information_schema queries. */
export type DatabaseForeignKey = {
  table: string
  column: string
}

export type DatabaseColumnMetadata = {
  column_name: string
  data_type: string
  udt_name: string
  is_nullable: 'YES' | 'NO'
  column_default: string | null
  is_primary_key: boolean
  foreign_key: DatabaseForeignKey | null
}

export type DatabaseCountRow = {
  count: number | string
}
