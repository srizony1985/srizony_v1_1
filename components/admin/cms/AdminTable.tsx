'use client'

import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileUp } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type SortDirection = 'asc' | 'desc'

export type AdminTableColumn<Row> = {
  key: string
  label: ReactNode
  accessor?: (row: Row) => unknown
  render?: (row: Row, index: number) => ReactNode
  sortable?: boolean
  exportable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
  className?: string
  headerClassName?: string
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return '[Unserializable value]' }
  }
  return String(value)
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
function compareValues(first: unknown, second: unknown) {
  const a = cellText(first).trim()
  const b = cellText(second).trim()
  if (a === b) return 0
  const an = a === '' ? NaN : Number(a)
  const bn = b === '' ? NaN : Number(b)
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn
  if (!a) return -1
  if (!b) return 1
  return collator.compare(a, b)
}

function csvEscape(value: unknown) {
  let text = cellText(value)
  // Prevent spreadsheet formula injection without changing normal negative numbers.
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-(?:\d+(?:\.\d+)?|\.\d+)$/.test(text))) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Reusable CMS data grid.
 * - Sorting is enabled by default.
 * - Selection is opt-in and can be controlled by the parent.
 * - CSV export is opt-in and split in two independent props:
 *     `exportable`         -> "Export all" button
 *     `selectedExportable` -> "Export selected" button (also requires `selectable`)
 *   The actions bar only renders when at least one of them (or import) is enabled.
 * - Import is opt-in and must be handled/validated by the owning domain.
 * - The table's single scroll viewport contains both vertical and horizontal overflow.
 *   Its header sticks inside that viewport; the action bar and summary remain fixed.
 */
export function AdminTable<Row>({
  rows,
  columns,
  getRowId,
  caption,
  emptyMessage = 'No records are available.',
  sortable = true,
  selectable = false,
  exportable = false,
  selectedExportable = false,
  exportImportable = false,
  onImportFile,
  onImportError,
  selectedIds,
  onSelectionChange,
  fileName = 'cms-export.csv',
  rowClassName,
  footerSummary,
  scrollClassName,
  tableClassName,
  loading = false,
  height = '100%',
  minHeight = '0px',
  maxHeight,
  className,
}: {
  rows: Row[]
  columns: AdminTableColumn<Row>[]
  getRowId: (row: Row, index: number) => string | number
  caption?: string
  emptyMessage?: string
  sortable?: boolean
  selectable?: boolean
  /** Show the "Export all" button. Off by default. */
  exportable?: boolean
  /** Show the "Export selected" button. Off by default; requires `selectable`. */
  selectedExportable?: boolean
  exportImportable?: boolean
  onImportFile?: (file: File) => void | Promise<void>
  onImportError?: (error: Error) => void
  selectedIds?: readonly string[]
  onSelectionChange?: (selectedIds: string[]) => void
  fileName?: string
  rowClassName?: (row: Row, index: number) => string | undefined
  footerSummary?: ReactNode
  scrollClassName?: string
  tableClassName?: string
  loading?: boolean
  /** Use 100% when inside AdminDataContainer, or a viewport value when standalone. */
  height?: string
  minHeight?: string
  maxHeight?: string
  className?: string
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => selectedIds === undefined ? internalSelected : new Set(selectedIds),
    [internalSelected, selectedIds],
  )

  const sourceRows = useMemo(() => rows.map((row, originalIndex) => ({
    row,
    originalIndex,
    id: String(getRowId(row, originalIndex)),
  })), [getRowId, rows])

  const sortedRows = useMemo(() => {
    if (!sortable || !sortKey) return sourceRows
    const column = columns.find((item) => item.key === sortKey)
    if (!column) return sourceRows
    return [...sourceRows].sort((first, second) => {
      const comparison = compareValues(
        column.accessor ? column.accessor(first.row) : (first.row as Record<string, unknown>)[column.key],
        column.accessor ? column.accessor(second.row) : (second.row as Record<string, unknown>)[column.key],
      )
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [columns, sourceRows, sortable, sortDirection, sortKey])

  const visibleIds = sortedRows.map((entry) => entry.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  const someSelected = selectedVisible.length > 0 && !allSelected
  const tableHeightStyle = {
    '--cms-table-height': height,
    '--cms-table-min-height': minHeight,
    ...(maxHeight ? { '--cms-table-max-height': maxHeight } : {}),
  } as CSSProperties

  function updateSelection(next: Set<string>) {
    if (selectedIds === undefined) setInternalSelected(next)
    onSelectionChange?.([...next])
  }

  function toggleOne(id: string, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    updateSelection(next)
  }

  function toggleAll(checked: boolean) {
    const next = new Set(selected)
    visibleIds.forEach((id) => checked ? next.add(id) : next.delete(id))
    updateSelection(next)
  }

  function sortBy(column: AdminTableColumn<Row>) {
    if (!sortable || column.sortable === false) return
    setSortDirection((current) => sortKey === column.key && current === 'asc' ? 'desc' : 'asc')
    setSortKey(column.key)
  }

  function exportCsv(scope: 'all' | 'selected' = 'all') {
    const exportColumns = columns.filter((column) => column.exportable !== false)
    const exportRows = scope === 'selected' ? sortedRows.filter((entry) => selected.has(entry.id)) : sortedRows
    if (!exportColumns.length || !exportRows.length) return
    const header = exportColumns.map((column) => csvEscape(typeof column.label === 'string' ? column.label : column.key)).join(',')
    const body = exportRows.map(({ row }) => exportColumns.map((column) => csvEscape(
      column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.key],
    )).join(','))
    const csv = `\uFEFF${[header, ...body].join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = scope === 'selected' ? fileName.replace(/(\.csv)?$/i, '-selected.csv') : fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !onImportFile) return
    setImportError('')
    setImporting(true)
    try {
      await onImportFile(file)
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error('The import operation failed.')
      if (onImportError) onImportError(error)
      else setImportError(error.message)
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  // Each export button is controlled by its own prop.
  const showExportAll = exportable
  const showExportSelected = selectable && selectedExportable
  const showImport = Boolean(exportImportable && onImportFile)
  const tableActionsVisible = showExportAll || showExportSelected || showImport || Boolean(importError)

  return (
    <section
      className={cn(
        'admin-common-table grid h-(--cms-table-height) min-h-(--cms-table-min-height) min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-border bg-card text-(length:--cms-table-font-size,12px) text-foreground max-h-(--cms-table-max-height,none)',
        className,
      )}
      style={tableHeightStyle}
      aria-label={caption || 'Data table'}
      aria-busy={loading || importing}
      data-loading={loading || undefined}
      data-sortable={sortable}
      data-selectable={selectable}
      data-exportable={showExportAll}
      data-selected-exportable={showExportSelected}
      data-importable={showImport}
    >
      {tableActionsVisible && (
        <header className="admin-table-actions relative z-10 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-(length:--cms-control-font-size,13px)">
          <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Table data actions">
            {showImport && <>
              <input ref={fileRef} type="file" accept=".csv,.json,application/json,text/csv" hidden onChange={(event) => void handleFile(event)} aria-label="Choose data file to import" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                <FileUp aria-hidden="true" />{importing ? 'Importing…' : 'Import'}
              </Button>
            </>}
            {showExportAll && <Button type="button" variant="outline" size="sm" onClick={() => exportCsv('all')} disabled={!sortedRows.length}>
              <Download aria-hidden="true" />Export all
            </Button>}
            {showExportSelected && <Button type="button" variant="outline" size="sm" onClick={() => exportCsv('selected')} disabled={!selectedVisible.length}>
              <Download aria-hidden="true" />Export selected ({selectedVisible.length.toLocaleString()})
            </Button>}
          </div>
          {importError && <p className="m-0 max-w-full text-sm text-destructive wrap-anywhere" role="alert">{importError}</p>}
        </header>
      )}

      <Table
        containerClassName={cn('admin-table-scroll min-h-0 h-full w-full overflow-auto overscroll-contain [scrollbar-gutter:stable]', scrollClassName)}
        className={cn('min-w-190 border-separate border-spacing-0 text-(length:--cms-table-font-size,12px)', tableClassName)}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader className="sticky top-0 z-20 text-secondary-foreground">
          <TableRow className="border-0 bg-background hover:bg-secondary">
            {selectable && (
              <TableHead className="sticky top-0 z-20 h-11 w-10 border-b-2 border-border bg-foreground px-3 py-0">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Select all visible rows"
                  disabled={!visibleIds.length || loading}
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const active = sortKey === column.key
              const canSort = sortable && column.sortable !== false
              const columnStyle = { width: column.width || 'auto', textAlign: column.align || 'left' } as CSSProperties
              const SortIcon = active ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <TableHead
                  key={column.key}
                  className={cn(
                    'sticky top-0 z-20 h-11 whitespace-nowrap border-b-2 border-border px-3 py-0 text-(length:--cms-table-font-size,12px) font-semibold uppercase tracking-[.06em] text-secondary-foreground',
                    active && 'text-primary',
                    column.headerClassName,
                  )}
                  style={columnStyle}
                  aria-sort={canSort && active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {canSort ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-mx-1 h-7 max-w-full gap-1.5 px-1 text-[length:inherit] font-[inherit] uppercase tracking-[inherit] text-inherit hover:bg-accent hover:text-accent-foreground"
                      onClick={() => sortBy(column)}
                      aria-label={`Sort by ${typeof column.label === 'string' ? column.label : column.key}`}
                    >
                      <span>{column.label}</span>
                      <SortIcon size={14} aria-hidden="true" className={cn('shrink-0', !active && 'opacity-50')} />
                    </Button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody className={cn(loading && 'opacity-70')}>
          {sortedRows.map(({ row, originalIndex, id }) => {
            const rowSelected = selected.has(id)
            return (
              <TableRow key={id} data-selected={rowSelected || undefined} data-state={rowSelected ? 'selected' : undefined} className={cn('group hover:bg-accent data-[selected=true]:bg-primary/8', rowClassName?.(row, originalIndex))}>
                {selectable && <TableCell className="w-10 border-b border-border/70 px-3 py-2.5 align-top">
                  <Checkbox checked={rowSelected} onChange={(event) => toggleOne(id, event.target.checked)} aria-label={`Select row ${id}`} disabled={loading} />
                </TableCell>}
                {columns.map((column) => <TableCell key={column.key} className={cn('border-b border-border/70 px-3 py-2.5 align-top text-foreground wrap-anywhere', column.className)} style={{ width: column.width || 'auto', textAlign: column.align || 'left' }}>
                  {column.render ? column.render(row, originalIndex) : cellText(column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.key]) || '—'}
                </TableCell>)}
              </TableRow>
            )
          })}
          {!sortedRows.length && <TableRow><TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10 text-center text-sm text-muted-foreground">{loading ? 'Loading records…' : emptyMessage}</TableCell></TableRow>}
        </TableBody>
      </Table>

      <footer
        className="admin-table-summary relative z-10 flex h-(--cms-table-footer-height,36px) min-w-0 shrink-0 items-center justify-between gap-3 overflow-hidden border-t border-border bg-muted px-3 text-(length:--cms-footer-font-size,12px) leading-none text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span className="min-w-0 truncate">
          {footerSummary || `Showing ${sortedRows.length.toLocaleString()} of ${rows.length.toLocaleString()} records`}
        </span>
        {selectable && (
          <span className="shrink-0 font-semibold tabular-nums text-primary">
            {selectedVisible.length.toLocaleString()} selected
          </span>
        )}
      </footer>
    </section>
  )
}