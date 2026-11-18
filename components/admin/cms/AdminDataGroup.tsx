import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Semantic grouping for a single dataset or editor domain in a viewport. */
export function AdminDataGroup({
  id,
  title,
  description,
  count,
  actions,
  children,
  className,
}: {
  id?: string
  title: ReactNode
  description?: ReactNode
  count?: number | string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('grid min-h-0 min-w-0 content-start gap-3', className)} aria-label={typeof title === 'string' ? title : undefined}>
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="m-0 font-sans text-(length:--cms-data-heading-font-size,16px) font-semibold text-foreground">{title}</h2>
          {description && <p className="m-0 text-(length:--cms-control-font-size,13px) leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {count !== undefined && <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-(length:--cms-control-font-size,13px) font-semibold tabular-nums text-muted-foreground">{typeof count === 'number' ? count.toLocaleString() : count}</span>}
          {actions && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2" role="group" aria-label="Data group actions">{actions}</div>}
        </div>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
