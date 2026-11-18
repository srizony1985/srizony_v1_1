import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { NavGroup } from '@/types/entityType'

type BodyScroll = 'auto' | 'hidden' | 'visible'
type Density = 'compact' | 'comfortable'

/**
 * Fixed-height dataset/editor frame.
 * Header and footer occupy their own grid rows; only the middle data region scrolls.
 * This avoids sticky-positioning bugs caused by nested overflow ancestors.
 */
export function AdminDataContainer({
  id,
  label,
  title,
  description,
  actions,
  headerContent,
  footer,
  status,
  instructions,
  footerActions,
  children,
  className,
  bodyClassName,
  bodyScroll = 'auto',
  density = 'comfortable',
  height = 'min(84dvh, 840px)',
  minHeight = '280px',
  maxHeight,
}: {
  id?: string
  label: string
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  headerContent?: ReactNode
  footer?: ReactNode
  status?: { info?: NavGroup; content: ReactNode; }
  instructions?: ReactNode
  footerActions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  bodyScroll?: BodyScroll
  density?: Density
  /** A CSS length. Defaults to a viewport-bounded, fixed workspace height. */
  height?: string
  minHeight?: string
  maxHeight?: string
}) {
  const hasHeader = Boolean(headerContent || title || description || actions)
  const hasFooter = Boolean(footer || status || instructions || footerActions)
  const bodyOverflow = bodyScroll === 'hidden' ? 'overflow-hidden' : bodyScroll === 'visible' ? 'overflow-visible' : 'overflow-auto'
  const style = {
    '--cms-data-height': height,
    '--cms-data-min-height': minHeight,
    ...(maxHeight ? { '--cms-data-max-height': maxHeight } : {}),
  } as CSSProperties

  return (
  <section
    id={id}
    className={cn(
      'admin-data-container grid w-100vw h-(--cms-data-height) min-h-(--cms-data-min-height) min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-sm max-h-(--cms-data-max-height,none)',
      density === 'compact'
        ? 'text-(length:--cms-table-font-size,12px)'
        : 'text-(length:--cms-control-font-size,13px)',
      className,
    )}
    style={style}
    aria-label={label}
    data-body-scroll={bodyScroll}
    data-density={density}
    data-has-header={hasHeader}
    data-has-footer={hasFooter}
  >
    {hasHeader && (
      <header className="admin-data-container-header relative z-20 flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        {headerContent || (
          <>
            <div className="grid min-w-0 flex-1 gap-1">
              {title && (
                <h2 className="m-0 truncate text-(length:--cms-data-heading-font-size,16px) font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p className="m-0 text-(length:--cms-control-font-size,13px) leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div
                className="flex min-w-0 flex-wrap items-center justify-end gap-2"
                role="group"
                aria-label={`${label} actions`}
              >
                {actions}
              </div>
            )}
          </>
        )}
      </header>
    )}

    <div
      className={cn(
        'cms-data-scroll h-full min-h-0 min-w-0 overscroll-contain [scrollbar-gutter:stable]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        bodyOverflow,
        bodyClassName,
      )}
      tabIndex={0}
      role="region"
      aria-label={`${label} data`}
    >
      {children}
    </div>

    {hasFooter && (
      <footer className="admin-data-container-footer relative z-20 flex min-h-(--cms-data-footer-height,40px) min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-muted px-3 py-1.5 text-(length:--cms-footer-font-size,12px) text-muted-foreground">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          {status?.content ? (
            <span className="font-semibold text-foreground" role="status" aria-live="polite">
              {status.content}
            </span>
          ) : status?.info ? (
            <span className="font-semibold text-foreground" role="status" aria-live="polite">
              {JSON.stringify(status.info)}
            </span>
          ) : null}
          {instructions && <span>{instructions}</span>}
          {footer}
        </div>
        {footerActions && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-end gap-2"
            role="group"
            aria-label={`${label} footer actions`}
          >
            {footerActions}
          </div>
        )}
      </footer>
    )}
  </section>
)
}
