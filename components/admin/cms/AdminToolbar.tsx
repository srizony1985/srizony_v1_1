'use client'

import type { ReactNode } from 'react'
import { RefreshCw, Search, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type AdminToolbarActionVariant = 'primary' | 'secondary' | 'danger' | 'quiet'

/** Typed action control for contextual CMS toolbars. */
export function AdminToolbarAction({
  children,
  icon: Icon,
  onClick,
  variant = 'secondary',
  disabled = false,
  title,
  type = 'button',
}: {
  children: ReactNode
  icon?: LucideIcon
  onClick: () => void
  variant?: AdminToolbarActionVariant
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
}) {
  return (
    <Button
      type={type}
      variant={variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : variant === 'quiet' ? 'ghost' : 'outline'}
      size="sm"
      className="shrink-0 gap-1.5 text-(length:--cms-control-font-size,13px)"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}{children}
    </Button>
  )
}

export function AdminToolbarBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const toneClasses = {
    neutral: 'border-border bg-muted text-muted-foreground',
    success: 'border-success/40 bg-success/10 text-success',
    warning: 'border-warning/40 bg-warning/10 text-warning',
    danger: 'border-destructive/40 bg-destructive/10 text-destructive',
    info: 'border-primary/35 bg-primary/10 text-primary',
  }[tone]
  return <Badge variant="outline" className={cn('inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-(length:--cms-control-font-size,13px) font-semibold tabular-nums', toneClasses)}>{children}</Badge>
}

export function AdminToolbarSearch({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const label = placeholder.replace(/…$/, '')
  return (
    <label className="relative flex w-full min-w-0 flex-1 items-center sm:min-w-[min(100%,220px)]" aria-label={label}>
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        type="search"
        className="admin-theme-search-input h-10 w-full rounded-md border-input bg-card pl-9 pr-3 text-(length:--cms-control-font-size,13px) text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-ring/25"
      />
    </label>
  )
}

export function AdminToolbarFilterGroup({ children, label = 'Filter options' }: { children: ReactNode; label?: string }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={label}>{children}</div>
}

type AdminToolbarProps = {
  title?: string
  description?: ReactNode
  count?: number
  search?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  onRefresh?: () => void
  refreshing?: boolean
  actions?: ReactNode
  filters?: ReactNode
  tabs?: ReactNode
  className?: string
}

export function AdminToolbar({
  title = 'Section',
  description,
  count,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  onRefresh,
  refreshing = false,
  actions,
  filters,
  tabs,
  className,
}: AdminToolbarProps) {
  // Which options were chosen
  const hasHeader = Boolean(tabs || description || count !== undefined)
  const hasControls = Boolean(onSearch || filters)
  const hasActions = Boolean(onRefresh || actions)
  const hasBelowTabsDescription = Boolean(tabs && description)

  // Controls and actions share one row on wide screens when there is no header
  const inlineRow = hasControls && hasActions && !hasHeader

  const rootClass = cn(
    'sticky top-0 z-30 grid w-full min-w-0 gap-3 rounded-lg border-b border-border bg-background/80 p-2 backdrop-blur',
    'text-(length:--cms-toolbar-font-size,13px)',
    inlineRow ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-center' : 'grid-cols-1',
    !hasHeader && !hasControls && !hasActions && 'hidden',
    className,
  )

  const headerClass = cn(
    'flex min-w-0 flex-wrap justify-between gap-3',
    tabs ? 'items-end' : 'items-center',
    count !== undefined && !tabs && !description && 'justify-end',
  )

  const controlsClass = cn(
    'flex min-w-0 items-center gap-2',
    onSearch && filters ? 'flex-col sm:flex-row' : 'flex-row',
    !onSearch && filters && 'flex-wrap',
  )

  const actionsClass = cn(
    'flex min-w-0 shrink-0 flex-wrap items-center gap-2',
    inlineRow ? 'justify-start md:justify-end' : 'justify-end',
  )

  return (
    <section className={rootClass} aria-label={`${title} tools`}>
      {hasHeader && (
        <div className={cn(headerClass, inlineRow && 'md:col-span-2')}>
          {tabs ? (
            <div className="min-w-0 flex-1">{tabs}</div>
          ) : (
            description && (
              <p className="m-0 min-w-0 flex-1 leading-relaxed text-muted-foreground">{description}</p>
            )
          )}
          {count !== undefined && (
            <AdminToolbarBadge tone="info">{count.toLocaleString()} records</AdminToolbarBadge>
          )}
        </div>
      )}

      {hasBelowTabsDescription && (
        <p className="m-0 leading-relaxed text-muted-foreground">{description}</p>
      )}

      {hasControls && (
        <div className={controlsClass}>
          {onSearch && (
            <AdminToolbarSearch value={search ?? ''} onChange={onSearch} placeholder={searchPlaceholder} />
          )}
          {filters && <AdminToolbarFilterGroup>{filters}</AdminToolbarFilterGroup>}
        </div>
      )}

      {hasActions && (
        <div className={actionsClass} role="group" aria-label={`${title} actions`}>
          {onRefresh && (
            <AdminToolbarAction
              icon={RefreshCw}
              onClick={onRefresh}
              disabled={refreshing}
              variant="secondary"
              title="Refresh this section"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </AdminToolbarAction>
          )}
          {actions}
        </div>
      )}
    </section>
  )
}