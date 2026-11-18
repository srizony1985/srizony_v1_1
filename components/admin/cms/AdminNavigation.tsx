'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const navItemBase = 'group flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-[length:var(--cms-sidebar-font-size,12px)] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const navActive = 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'

export function AdminNavigationLink({
  href,
  label,
  icon: Icon,
  active = false,
  compact = false,
  onClick,
}: {
  href: string
  label: string
  icon: LucideIcon
  active?: boolean
  compact?: boolean
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <Link
      href={href}
      className={cn(navItemBase, active && navActive, compact && 'justify-center px-2')}
      data-nav-label={label}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {!compact && <span className="min-w-0 flex-1 truncate">{label}</span>}
    </Link>
  )
}

export function AdminNavigationGroupToggle({
  label,
  icon: Icon,
  active = false,
  expanded = false,
  compact = false,
  controls,
  onClick,
}: {
  label: string
  icon: LucideIcon
  active?: boolean
  expanded?: boolean
  compact?: boolean
  controls?: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      title={compact ? label : undefined}
      aria-label={`${!compact && expanded ? 'Collapse' : 'Expand'} ${label}`}
      aria-expanded={!compact && expanded}
      aria-controls={!compact ? controls : undefined}
      className={cn(navItemBase, active && navActive, compact && 'justify-center px-2')}
      data-nav-label={label}
      onClick={onClick}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {!compact && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!compact && <ChevronDown className={cn('size-4 shrink-0 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />}
    </Button>
  )
}

export function AdminNavigationChildLink({
  href,
  label,
  icon: Icon,
  active = false,
  onClick,
}: {
  href: string
  label: string
  icon?: LucideIcon
  active?: boolean
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <Link
      href={href}
      className={cn('flex min-h-9 min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-(length:--cms-sidebar-font-size,12px) text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && navActive)}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  )
}

export function AdminNavigationSectionLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1 pt-5 text-(length:--cms-sidebar-font-size,12px) font-semibold uppercase tracking-[.12em] text-sidebar-foreground/50">{children}</div>
}
