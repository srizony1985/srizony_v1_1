'use client'

import type { JsonValue } from '@/types/json'

import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminToolbar, AdminTabs, type AdminTabItem } from '@/components/admin/cms'

/** Runs an async loader from /lib/api and tracks loading/error state. `deps` re-triggers the load. */
export function useAdminFetch<T>(loader: () => Promise<T>, deps: JsonValue[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loaderRef = useRef(loader)
  const runId = useRef(0)
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  const reload = useCallback(() => {
    const id = ++runId.current
    setLoading(true)
    setError('')
    return Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (id === runId.current) setData(result)
      })
      .catch((cause: unknown) => {
        if (id === runId.current) setError(cause instanceof Error ? cause.message : 'Unable to load data.')
      })
      .finally(() => {
        if (id === runId.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const runIdRef = runId
    const timeoutId = window.setTimeout(() => { void reload() }, 0)
    return () => {
      window.clearTimeout(timeoutId)
      runIdRef.current++
    }
  }, [reload, depsKey])

  return { data, setData, loading, error, reload }
}

export type AdminSectionTabItem = AdminTabItem

/** Compatibility export; implementation is owned by the shared CMS component package. */
export function AdminSectionTabs(props: {
  items: AdminSectionTabItem[]
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  return <AdminTabs {...props} />
}

type SectionToolbarProps = ComponentProps<typeof AdminToolbar>

/** Thin wrapper that forwards every AdminToolbar option (including className). */
export function SectionToolbar({ title = 'Section', ...rest }: SectionToolbarProps) {
  return <AdminToolbar title={title} {...rest} />
}

export function PageLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="admin-loading-grid grid grid-cols-[repeat(4,1fr)] gap-3.5 max-[460px]:grid-cols-[1fr] max-[1100px]:grid-cols-2 max-[760px]:grid-cols-2 max-[480px]:grid-cols-[1fr] [&>div]:min-h-27.5 [&>div]:[border:1px_solid_var(--border)] [&>div]:[box-shadow:none]" aria-label="Loading" role="status">
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <Card key={index} className="min-h-27.5 w-full border-border shadow-none">
          <Skeleton className="h-28 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  )
}

export function AdminErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="admin-error-state p-5 [border:1px_solid_color-mix(in_srgb,var(--destructive)_25%,var(--border))] rounded-(--radius,var(--radius)) [background:color-mix(in_srgb,var(--destructive)_5%,var(--card))] text-primary [&_strong]:block [&_strong]:text-[0.875rem] [&_p]:m-[5px_0_12px] [&_p]:text-muted-foreground [&_p]:text-[0.875rem] grid gap-1.25 **:data-[slot=button]:w-max **:data-[slot=button]:mt-1" role="alert">
      <strong>Unable to load this section.</strong>
      <p>{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </section>
  )
}