import { useAdminTheme } from "@/app/admin/AdminThemeShell"
import { useAdminActions } from "@/app/admin/dashboard/_components/AdminActionContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProviderHealth } from "@/lib/api/adminWorkspace"
import { cn } from "@/lib/utils"
import { PanelLeftOpen, PanelLeftClose, Menu, Database, ShieldCheck, Sun, Moon, RefreshCw, Save } from "lucide-react"
import { useState } from "react"

export function AdminWorkspaceHeader({
  current,
  userEmail,
  providerHealth,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onOpenMobileNavigation,
}: {
  current: string
  userEmail?: string
  providerHealth: ProviderHealth
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
  onOpenMobileNavigation: () => void
}) {
  const { mode, setMode } = useAdminTheme()
  const userLabel = userEmail || 'CMS administrator'
  const userInitial = userLabel.trim().slice(0, 1).toLocaleUpperCase() || 'A'
  const provider = providerHealth.mode === 'google-drive-read-only'
    ? { label: 'Google Drive · Read-only', variant: 'warning' as const }
    : providerHealth.mode === 'unavailable'
      ? { label: 'Data unavailable', variant: 'destructive' as const }
      : { label: 'Neon PostgreSQL', variant: 'success' as const }
  const nextMode = mode === 'dark' ? 'light' : 'dark'

  return (
    <header className="admin-workspace-header @container/header sticky top-0 z-30 flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-border bg-background/95 px-2.5 py-1.5 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/80 sm:min-h-16 sm:gap-3 sm:px-4 lg:px-6">
      {/* Left: navigation toggle + title (shrinks and truncates) */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Button
          className="hidden shrink-0 md:inline-flex"
          variant="outline"
          size="icon"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="cms-primary-navigation"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </Button>
        <Button
          className="shrink-0 md:hidden"
          variant="outline"
          size="icon"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={onOpenMobileNavigation}
        >
          <Menu aria-hidden="true" />
        </Button>
        <div className="grid min-w-0 gap-0.5">
          <p className="m-0 hidden truncate text-(length:--cms-footer-font-size,11px) font-semibold uppercase tracking-[.12em] text-muted-foreground @md/header:block">
            CMS workspace
          </p>
          <h1 className="m-0 truncate text-(length:--cms-header-font-size,13px) font-semibold leading-tight tracking-tight text-foreground">
            {current}
          </h1>
        </div>
      </div>

      {/* Right: status + actions stay together; the entire group moves to a second row on narrow headers. */}
      <div
        className="admin-workspace-header-actions flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-1 @lg/header:gap-2"
        role="group"
        aria-label="Workspace status and global actions"
      >
        <Badge
          variant={provider.variant}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 @3xl/header:max-w-56"
          title={providerHealth.note || provider.label}
        >
          <Database className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only @3xl/header:not-sr-only @3xl/header:truncate">{provider.label}</span>
        </Badge>

        <div
          className="flex h-9 min-w-0 shrink-0 items-center gap-2 rounded-md border border-transparent p-1 text-(length:--cms-control-font-size,13px) @2xl/header:max-w-56 @2xl/header:border-border @2xl/header:bg-card @2xl/header:px-2"
          title={userLabel}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground" aria-hidden="true">
            {userInitial}
          </span>
          <span className="sr-only @2xl/header:not-sr-only @2xl/header:min-w-0 @2xl/header:truncate">{userLabel}</span>
          <ShieldCheck className="hidden size-4 shrink-0 text-muted-foreground @2xl/header:block" aria-hidden="true" />
        </div>

        <HeaderActions writesEnabled={providerHealth.mode === 'neon-primary'} />

        <Button
          className="shrink-0"
          variant="outline"
          size="icon"
          onClick={() => setMode(nextMode)}
          aria-label={`Switch to ${nextMode} mode`}
          title={`Switch to ${nextMode} mode`}
        >
          {mode === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </div>
    </header>
  )
}

function HeaderActions({ writesEnabled }: { writesEnabled: boolean }) {
  const { hasSave, hasReload, dirty, saving, runSave, runReload } = useAdminActions()
  const [reloading, setReloading] = useState(false)

  function reload() {
    if (dirty && !window.confirm('Reload CMS data and discard unsaved changes in the open editors?')) return
    setReloading(true)
    if (!hasReload) {
      window.location.reload()
      return
    }
    void runReload().finally(() => setReloading(false))
  }

  return (
    <div className="inline-flex min-w-0 shrink-0 items-center gap-1" role="group" aria-label="Save and reload actions">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1.5 px-2.5 text-(length:--cms-control-font-size,13px)"
        onClick={reload}
        disabled={reloading}
        title="Reload current CMS data"
      >
        <RefreshCw className={cn('size-4', reloading && 'animate-spin')} aria-hidden="true" />
        <span className="sr-only @2xl/header:not-sr-only">Reload</span>
      </Button>

      <Button
        type="button"
        size="sm"
        className="relative h-9 shrink-0 gap-1.5 px-2.5 text-(length:--cms-control-font-size,13px)"
        onClick={() => void runSave()}
        disabled={!writesEnabled || !hasSave || !dirty || saving}
        title={
          !writesEnabled
            ? 'Saving is unavailable while the CMS is using read-only Google Drive snapshots'
            : dirty
              ? 'Save all unsaved changes in the open editors'
              : 'There are no unsaved changes'
        }
      >
        <Save className="size-4" aria-hidden="true" />
        <span className="sr-only @lg/header:not-sr-only">{saving ? 'Saving…' : 'Save all'}</span>
        {dirty && (
          <>
            <span
              className="absolute -right-1 -top-1 size-2.5 rounded-full bg-warning ring-2 ring-background"
              aria-hidden="true"
            />
            <span className="sr-only">Unsaved changes</span>
          </>
        )}
      </Button>
    </div>
  )
}
