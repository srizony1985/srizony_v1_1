import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Common grid primitive for every CMS viewport and data group. */
export function AdminGrid({
  children,
  columns,
  minColumnWidth = '280px',
  gap = '16px',
  rowGap,
  className,
  ariaLabel,
  as: Element = 'div',
}: {
  children: ReactNode
  columns?: string
  minColumnWidth?: string
  gap?: string
  rowGap?: string
  className?: string
  ariaLabel?: string
  as?: 'div' | 'section' | 'ul'
}) {
  const style = {
    '--cms-grid-columns': columns || 'repeat(auto-fit, minmax(min(100%, var(--cms-grid-min-column, 280px)), 1fr))',
    '--cms-grid-gap': gap,
    '--cms-grid-row-gap': rowGap || gap,
    '--cms-grid-min-column': minColumnWidth,
  } as CSSProperties
  return (
    <Element
      className={cn('admin-common-grid grid min-h-0 min-w-0 content-start font-sans text-foreground grid-cols-(--cms-grid-columns) gap-x-(--cms-grid-gap) gap-y-(--cms-grid-row-gap)', className)}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </Element>
  )
}
