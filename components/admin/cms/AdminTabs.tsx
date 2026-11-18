'use client'

import { Button } from '@/components/ui/button'
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export type AdminTabItem = {
  value: string
  label: string
  icon?: ReactNode
  count?: number
  countPosition?: 'inline' | 'corner'
  disabled?: boolean
}

/** Contextual tabs with accessible selection, visible counts and roving keyboard focus. */
export function AdminTabs({
  items,
  value,
  onChange,
  label = 'Workspace sections',
  className,
  id,
  panelId,
}: {
  items: AdminTabItem[]
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
  /** Optional stable ID prefix, used to associate tabs with their panel. */
  id?: string
  /** Optional ID of the tabpanel controlled by this tab set. */
  panelId?: string
}) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[role="tab"]') : null
    const currentIndex = target ? tabs.indexOf(target) : -1
    if (currentIndex < 0 || !tabs.length) return

    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return

    event.preventDefault()
    const nextTab = tabs[nextIndex]
    nextTab.focus()
    const nextValue = nextTab.dataset.tabValue
    if (nextValue) onChange(nextValue)
  }

  return (
    <div
      id={id}
      className={cn('flex max-w-full min-w-0 items-end gap-1 overflow-x-auto border-b border-border', className)}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const selected = value === item.value
        return (
          <Button
            key={item.value}
            id={id ? `${id}-${item.value}-tab` : undefined}
            type="button"
            variant="ghost"
            role="tab"
            data-tab-value={item.value}
            aria-selected={selected}
            aria-controls={panelId}
            aria-disabled={item.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2 text-(length:--cms-toolbar-font-size,13px) font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              'aria-selected:border-primary aria-selected:bg-primary/5 aria-selected:text-primary',
              item.countPosition === 'corner' && 'relative pr-4',
            )}
            onClick={() => onChange(item.value)}
          >
            {item.icon && <span className="inline-flex shrink-0 items-center [&>svg]:size-4" aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-(length:--cms-footer-font-size,11px) font-semibold tabular-nums text-muted-foreground">
                {item.count.toLocaleString()}
                <span className="sr-only"> {item.label.toLowerCase()}</span>
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
