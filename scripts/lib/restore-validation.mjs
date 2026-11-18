/**
 * Validation for curated recovery snapshots with reconstructed values.
 */
const DERIVED_COLUMNS = Object.freeze({
  // Filled from _restore_image_src after media_items rows have been inserted.
  hero_slides: new Set(['image_id']),
})

export function assertSnapshotRowRequiredColumns(table, row, rowIndex, metadata) {
  const supplied = new Set(Object.keys(row))
  const derived = DERIVED_COLUMNS[table] || new Set()

  for (const [columnName, column] of metadata) {
    const generated = column.is_identity === 'YES' || column.is_generated === 'ALWAYS'
    const hasDefault = column.column_default !== null
    const isDerived = derived.has(columnName)

    if (column.is_nullable === 'NO' && !generated && !hasDefault && !supplied.has(columnName) && !isDerived) {
      throw new Error(`${table}.json row ${rowIndex + 1} is missing required column "${columnName}".`)
    }
    if (column.is_nullable === 'NO' && supplied.has(columnName) && row[columnName] === null) {
      throw new Error(`${table}.json row ${rowIndex + 1} has NULL for required column "${columnName}".`)
    }
    if (supplied.has(columnName) && row[columnName] === undefined) {
      throw new Error(`${table}.json row ${rowIndex + 1} has an undefined value for "${columnName}".`)
    }
  }
}

export function validateSnapshotRelationshipTransforms(snapshotData) {
  const slides = snapshotData.get('hero_slides')?.doc?.rows
  if (!Array.isArray(slides) || slides.length === 0) return

  const mediaRows = snapshotData.get('media_items')?.doc?.rows
  if (!Array.isArray(mediaRows)) {
    throw new Error('hero_slides recovery requires media_items.json to rebuild image_id references.')
  }

  const mediaUrls = new Set(mediaRows.map((row) => row?.src).filter((src) => typeof src === 'string' && src.length > 0))
  for (let index = 0; index < slides.length; index += 1) {
    const source = slides[index]?._restore_image_src
    if (typeof source !== 'string' || source.length === 0) {
      throw new Error(`hero_slides.json row ${index + 1} is missing _restore_image_src; image_id cannot be reconstructed.`)
    }
    if (!mediaUrls.has(source)) {
      throw new Error(`hero_slides.json row ${index + 1} refers to media URL not present in media_items.json: ${source}`)
    }
  }
}
