import type { ReactNode } from 'react'
import type { ProviderHealth } from '@/lib/api/adminWorkspace'
import { cn } from '@/lib/utils'

/** Fixed authenticated application frame. The browser document never becomes the CMS scroll area. */
export function AdminAppShell({
  children,
  collapsed = false,
  mobileOpen = false,
}: {
  children: ReactNode
  collapsed?: boolean
  mobileOpen?: boolean
}) {
  return (
    <div
      className="group/admin-shell relative flex h-dvh min-h-dvh w-full min-w-0 overflow-hidden bg-background font-sans text-(length:--cms-base-font-size,14px) text-foreground antialiased"
      data-cms-shell
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
    >
      {children}
    </div>
  )
}

/** Persistent, collapsible sidebar. Its middle region is independently scrollable. */
export function AdminNavigationSidebar({ children }: { children: ReactNode }) {
  return (
    <aside
      className={cn(
        'admin-sidebar absolute inset-y-0 left-0 z-50 flex h-full w-64 min-w-0 shrink-0 -translate-x-full flex-col overflow-hidden border-r border-sidebar-border bg-background text-text shadow-xl transition-[width,transform] duration-200 motion-reduce:transition-none md:relative md:z-0 md:translate-x-0 md:shadow-none',
        'group-data-[mobile-open=true]/admin-shell:translate-x-0',
        'group-data-[collapsed=true]/admin-shell:md:w-18',
      )}
      aria-label="CMS sidebar"
      data-slot="sidebar"
    >
      {children}
    </aside>
  )
}

/**
 * Route viewport. The app header and provider footer live outside this component,
 * while the route itself owns one scroll surface and a responsive CSS grid.
 */
export function AdminViewportGrid({
  title,
  dirty,
  execution,
  children,
  layout = 'single',
}: {
  title: string
  dirty: boolean
  execution?: { action: 'save' | 'reload'; label: string; status: 'running' | 'completed' | 'partial'; actualDurationMs?: number; estimatedDurationMs?: number; completedAt?: string } | null
  children: ReactNode
  layout?: 'single' | 'split' | 'dashboard' | 'fluid'
}) {
  const executionMessage = !execution ? null : execution.status === 'running'
    ? `${execution.label} is running…`
    : `${execution.label} ${execution.status === 'partial' ? 'partially completed' : 'completed'} · actual ${execution.actualDurationMs ?? 0} ms${execution.estimatedDurationMs === undefined ? '' : ` · expected ${execution.estimatedDurationMs} ms`}`
  const gridLayout = layout === 'dashboard'
    ? 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4'
    : layout === 'split'
      ? 'grid-cols-1 xl:grid-cols-2'
      : layout === 'fluid'
        ? '[grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]'
        : 'grid-cols-1'

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background" aria-label="CMS page workspace" data-viewport-layout={layout}>
      <div className="cms-viewport-scroll min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4 md:px-5 lg:px-7" tabIndex={0} role="region" aria-label={`${title} workspace`}>
        <div className={cn('admin-viewport-grid mx-auto grid min-h-full w-full min-w-0 content-start gap-4', gridLayout)} data-grid-layout={layout}>
          {children}
        </div>
      </div>
      <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-border border-t bg-muted/40 px-4 py-2 text-(length:--cms-footer-font-size,11px) text-muted-foreground" role="status" aria-live="polite" data-slot="execution-status">
        <span className="font-medium text-foreground">{title}</span>
        <span>{dirty ? 'Unsaved changes · Use Save all in the header' : 'Workspace ready · All changes saved'}</span>
        {executionMessage && (
          <span
            className={cn('min-w-0 truncate', execution?.status === 'partial' ? 'text-warning' : execution?.status === 'completed' ? 'text-success' : 'text-primary')}
            title={executionMessage}
          >
            {executionMessage}
          </span>
        )}
      </div>
    </main>
  )
}

/** Provider attribution/status is a fixed footer, never part of route scrolling. */
export function AdminProviderFooter({ children, providerHealth }: { children?: ReactNode; providerHealth?: ProviderHealth }) {
  const providerLabel = providerHealth?.mode === 'neon-primary'
    ? 'Neon PostgreSQL · Primary'
    : providerHealth?.mode === 'google-drive-read-only'
      ? 'Google Drive · Read-only recovery'
      : providerHealth?.mode === 'unavailable'
        ? 'Data provider unavailable'
        : 'Provider status checking'
  const providerState = providerHealth?.mode === 'neon-primary' ? 'healthy' : providerHealth?.mode === 'google-drive-read-only' ? 'degraded' : providerHealth?.mode === 'unavailable' ? 'unavailable' : 'checking'

  return (
    <footer className="admin-provider-footer flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-border border-t bg-card px-4 py-2 text-(length:--cms-footer-font-size,11px) text-muted-foreground" data-slot="provider-footer">
      <div className="flex min-w-0 items-center gap-2" role="status" aria-live="polite" data-state={providerState}>
        <span
          className={cn('size-2 shrink-0 rounded-full', providerState === 'healthy' ? 'bg-success' : providerState === 'degraded' ? 'bg-warning' : providerState === 'unavailable' ? 'bg-destructive' : 'bg-muted-foreground')}
          aria-hidden="true"
        />
        <span className="truncate">{providerLabel}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1"><span>Website CMS · Recruitment Application</span><span>Developed by Scarlet Labs</span>{children}</div>
    </footer>
  )
}
