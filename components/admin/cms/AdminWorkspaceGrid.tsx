import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AdminWorkspaceLayout = 'single' | 'split'

/**
 * Route-level CMS workspace grid.
 *
 * `single` is the default for ordinary admin routes. `split` is reserved for
 * paired workflows where a selected record/editor and its dataset need to be
 * visible together. The split automatically stacks below the 1120px
 * breakpoint and never lets a child force horizontal page scrolling.
 */
export function AdminWorkspaceGrid({
  children,
  layout = 'single',
  columns = 'minmax(0, 0.88fr) minmax(0, 1.12fr)',
  gap = '16px',
  className,
  ariaLabel,
}: {
  children: ReactNode
  layout?: AdminWorkspaceLayout
  /** CSS grid-template-columns value for the wide split workspace. */
  columns?: string
  gap?: string
  className?: string
  ariaLabel?: string
}) {
  const style = {
    '--cms-workspace-columns': columns,
    '--cms-workspace-gap': gap,
  } as CSSProperties

  return (
    <div
      className={cn(
        'admin-workspace-grid grid min-h-0 min-w-0 grid-cols-1 items-start gap-(--cms-workspace-gap) *:min-w-0',
        layout === 'split' && 'min-[1120px]:grid-cols-(--cms-workspace-columns)',
        className,
      )}
      style={style}
      data-workspace-layout={layout}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
}
