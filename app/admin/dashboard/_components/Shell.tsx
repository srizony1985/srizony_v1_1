'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Briefcase, Building2, Database, Workflow, FileSpreadsheet, FileText, Type,
  LayoutDashboard, LogOut, Network, Settings, Users, X, PanelsTopLeft, Globe,
  LayoutGrid, Search, ExternalLink, TreePine,
  CoinsIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { adminLogout } from '@/lib/api/auth'
import { getAdminProviderHealth, type ProviderHealth } from '@/lib/api/adminWorkspace'
import { AdminActionProvider, useAdminActions } from './AdminActionContext'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  AdminAppShell,
  AdminNavigationSidebar,
  AdminProviderFooter,
  AdminViewportGrid,
  AdminWorkspaceHeader,
  AdminNavigationLink,
  AdminNavigationGroupToggle,
  AdminNavigationChildLink,
  AdminNavigationSectionLabel,
} from '@/components/admin/cms'

export type AdminNavItem = { label: string; href: string; icon?: LucideIcon }
export type AdminNavGroup =
  | { kind: 'link'; key: string; section: string; label: string; icon: LucideIcon; href: string }
  | { kind: 'group'; key: string; section: string; label: string; icon: LucideIcon; children: readonly AdminNavItem[] }

const GROUPS: readonly AdminNavGroup[] = [
  { kind: 'link', key: 'dashboard', section: 'Overview', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard/overview' },
  { kind: 'link', key: 'navigation', section: 'Content management', label: 'Site Navigation', icon: Network, href: '/admin/dashboard/navigation' },
  { kind: 'link', key: 'content', section: 'Content management', label: 'Site Content', icon: FileText, href: '/admin/dashboard/site-content' },
  { kind: 'link', key: 'page-builder', section: 'Content management', label: 'Page Builder', icon: PanelsTopLeft, href: '/admin/dashboard/page-builder' },
  { kind: 'link', key: 'portfolio', section: 'Content management', label: 'Portfolio', icon: Building2, href: '/admin/dashboard/portfolio' },
  { kind: 'link', key: 'jobs', section: 'Content management', label: 'Jobs & Applications', icon: Briefcase, href: '/admin/dashboard/jobs' },
  { kind: 'link', key: 'website-essentials', section: 'Content management', label: 'Website Essentials', icon: Globe, href: '/admin/dashboard/website-essentials' },
  { kind: 'link', key: 'footer', section: 'Content management', label: 'Footer Navigation', icon: LayoutGrid, href: '/admin/dashboard/footer' },
  { kind: 'link', key: 'visitors', section: 'Insights', label: 'Visitors & Reports', icon: Users, href: '/admin/dashboard/reports/visitors' },
  { kind: 'link', key: 'donations', section: 'Insights', label: 'Donations & Reports', icon: CoinsIcon, href: '/admin/dashboard/reports/donations' },
  { kind: 'link', key: 'cms-pipeline', section: 'System', label: 'CMS Data Pipeline', icon: Workflow, href: '/admin/dashboard/cms-pipeline' },
  { kind: 'link', key: 'site-configuration', section: 'System', label: 'Website Configuration', icon: Globe, href: '/admin/dashboard/site-configuration' },
  {
    kind: 'group',
    key: 'settings',
    section: 'System',
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'CMS Users', href: '/admin/dashboard/settings?view=users', icon: Users },
      { label: 'Database & APIs', href: '/admin/dashboard/settings?view=database', icon: Database },
      { label: 'Reporting', href: '/admin/dashboard/settings?view=reporting', icon: FileSpreadsheet },
      { label: 'Theme Typography', href: '/admin/dashboard/settings?view=theme', icon: Type },
      { label: 'Homepage Growth Tree', href: '/admin/dashboard/settings?view=growth', icon: TreePine },
    ],
  },
]

function routeParts(href: string) {
  try {
    const url = new URL(href, 'https://srizony.local')
    return { pathname: url.pathname, params: url.searchParams }
  } catch {
    return { pathname: href, params: new URLSearchParams() }
  }
}

function isActivePath(pathname: string, searchParams: URLSearchParams, href: string) {
  const target = routeParts(href)
  if (target.pathname !== pathname) return false
  for (const [key, value] of target.params.entries()) {
    if (searchParams.get(key) !== value) return false
  }
  return target.params.size ? true : searchParams.size === 0
}

function parentIsActive(pathname: string, searchParams: URLSearchParams, children: readonly AdminNavItem[]) {
  return children.some((item) => isActivePath(pathname, searchParams, item.href))
}

function titleFromRoute(pathname: string, searchParams: URLSearchParams) {
  for (const group of GROUPS) {
    if (group.kind === 'link' && isActivePath(pathname, searchParams, group.href)) return group.label
    if (group.kind === 'group') {
      const item = group.children.find((child) => isActivePath(pathname, searchParams, child.href))
      if (item) return item.label
    }
  }
  if (pathname === '/admin/dashboard/settings') return 'Settings'
  if (pathname.startsWith('/admin/dashboard/reports/donations')) return 'Donations'
  if (pathname.startsWith('/admin/dashboard/reports')) return 'Reports'
  if (pathname.startsWith('/admin/dashboard/ui-content')) return 'UI Text & Labels'
  return pathname.startsWith('/admin/dashboard') ? 'Dashboard' : 'CMS'
}

export default function Shell(props: { userEmail?: string; children: ReactNode }) {
  return <AdminActionProvider><ShellContent {...props} /></AdminActionProvider>
}

function ShellContent({ userEmail, children }: { userEmail?: string; children: ReactNode }) {
  const { dirty, execution } = useAdminActions()
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const router = useRouter()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('sf-admin-sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const [mobileOpenRoute, setMobileOpenRoute] = useState<string | null>(null)
  const mobileOpen = mobileOpenRoute === routeKey
  const [navigationQuery, setNavigationQuery] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const defaults = { settings: true }
    if (typeof window === 'undefined') return defaults
    try {
      const saved = localStorage.getItem('sf-admin-groups')
      if (!saved) return defaults
      const parsed = JSON.parse(saved)
      return typeof parsed === 'object' && parsed !== null ? { ...defaults, ...parsed } : defaults
    } catch {
      return defaults
    }
  })
  const [providerHealth, setProviderHealth] = useState<ProviderHealth>({ mode: 'neon-primary', note: 'Checking data provider health…' })

  const activeGroupKey = GROUPS.find((group) => group.kind === 'group' && parentIsActive(pathname, searchParams, group.children))?.key
  const expandedWithActive = useMemo(() => {
    if (!activeGroupKey) return expanded
    return expanded[activeGroupKey] ? expanded : { ...expanded, [activeGroupKey]: true }
  }, [activeGroupKey, expanded])

  useEffect(() => {
    try {
      localStorage.setItem('sf-admin-sidebar', collapsed ? 'collapsed' : 'expanded')
      localStorage.setItem('sf-admin-groups', JSON.stringify(expanded))
    } catch {
      // Sidebar preferences are optional.
    }
  }, [collapsed, expanded])

  useEffect(() => {
    let active = true
    const refreshProviderHealth = () => {
      void getAdminProviderHealth()
        .then((payload) => {
          if (active && ['neon-primary', 'google-drive-read-only', 'unavailable'].includes(payload.mode)) setProviderHealth(payload)
        })
        .catch(() => {
          if (active) setProviderHealth({ mode: 'unavailable', note: 'Provider health check failed.' })
        })
    }
    refreshProviderHealth()
    const timer = window.setInterval(refreshProviderHealth, 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpenRoute(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  const current = useMemo(() => titleFromRoute(pathname, searchParams), [pathname, searchParams])
  const compactSidebar = collapsed && !mobileOpen
  const visibleGroups = useMemo<AdminNavGroup[]>(() => {
    const query = navigationQuery.trim().toLocaleLowerCase()
    if (!query) return [...GROUPS]
    return GROUPS.flatMap<AdminNavGroup>((group): AdminNavGroup[] => {
      if (group.kind === 'link') return `${group.label} ${group.section}`.toLocaleLowerCase().includes(query) ? [group] : []
      const matchingChildren = group.children.filter((item) => `${item.label} ${item.href}`.toLocaleLowerCase().includes(query))
      if (`${group.label} ${group.section}`.toLocaleLowerCase().includes(query)) return [group]
      return matchingChildren.length ? [{ ...group, children: matchingChildren }] : []
    })
  }, [navigationQuery])

  function handleNavLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return
    const destination = new URL(event.currentTarget.href, window.location.href)
    const currentUrl = new URL(window.location.href)
    const changesRoute = destination.pathname !== currentUrl.pathname || destination.search !== currentUrl.search
    if (dirty && changesRoute && !window.confirm('You have unsaved CMS changes. Leave this page and discard them?')) {
      event.preventDefault()
      return
    }
    setMobileOpenRoute(null)
  }

  function logout() {
    if (dirty && !window.confirm('You have unsaved CMS changes. Sign out and discard them?')) return
    setLoggingOut(true)
    try { sessionStorage.removeItem('srizony-cms-welcome-shown-session-v1') } catch { /* Optional per-login guide preference. */ }
    void adminLogout()
      .catch(() => undefined)
      .finally(() => {
        router.replace('/admin/login')
        router.refresh()
      })
  }

  function toggleGroup(key: string) {
    setExpanded((currentState) => ({ ...currentState, [key]: !currentState[key] }))
  }

  function renderNavigation() {
    return (
      <nav id="cms-primary-navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label="Primary CMS navigation">
        {visibleGroups.map((group, index) => {
          const Icon = group.icon
          const active = group.kind === 'link'
            ? isActivePath(pathname, searchParams, group.href)
            : parentIsActive(pathname, searchParams, group.children)
          const isExpanded = group.kind === 'group' ? Boolean(navigationQuery.trim()) || Boolean(expandedWithActive[group.key]) : false
          const startsSection = index === 0 || visibleGroups[index - 1].section !== group.section
          const childPanelId = `cms-nav-${group.key}`

          return (
            <div key={group.key}>
              {startsSection && !compactSidebar && <AdminNavigationSectionLabel>{group.section}</AdminNavigationSectionLabel>}
              {group.kind === 'link' ? (
                <AdminNavigationLink href={group.href} label={group.label} icon={Icon} active={active} compact={compactSidebar} onClick={handleNavLinkClick} />
              ) : (
                <>
                  <AdminNavigationGroupToggle
                    label={group.label}
                    icon={Icon}
                    active={active}
                    expanded={isExpanded}
                    compact={compactSidebar}
                    controls={childPanelId}
                    onClick={() => {
                      if (compactSidebar) {
                        setCollapsed(false)
                        setExpanded((state) => ({ ...state, [group.key]: true }))
                      } else toggleGroup(group.key)
                    }}
                  />
                  {!compactSidebar && isExpanded && (
                    <div id={childPanelId} className="ml-4 mt-1 space-y-1 border-border border-l pl-2">
                      {group.children.map((item) => {
                        const ItemIcon = item.icon
                        const itemActive = isActivePath(pathname, searchParams, item.href)
                        return <AdminNavigationChildLink key={item.href} href={item.href} label={item.label} icon={ItemIcon} active={itemActive} onClick={handleNavLinkClick} />
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
        {visibleGroups.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground" role="status">No matching sections found.</p>}
      </nav>
    )
  }

  const showProviderBanner = providerHealth.mode === 'google-drive-read-only' || providerHealth.mode === 'unavailable'

  return (
    <AdminAppShell collapsed={collapsed} mobileOpen={mobileOpen}>
      {mobileOpen && <Button className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden" type="button" aria-label="Close navigation" onClick={() => setMobileOpenRoute(null)} />}
      <AdminNavigationSidebar>
        <div className={cn('flex min-h-16 items-center gap-3 border-border border-b px-3 py-3', compactSidebar && 'justify-center px-2')}>
          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border-border bg-background p-1">
            <Image src="/images/Logo-SF.png" alt="Srizony Foundation" width={36} height={36} className="size-full object-contain" priority />
          </div>
          {!compactSidebar && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-5">Srizony Foundation</p>
              <p className="truncate text-xs text-muted-foreground">Content management</p>
            </div>
          )}
          <Button className="ml-auto md:hidden" variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setMobileOpenRoute(null)}>
            <X aria-hidden="true" />
          </Button>
        </div>

        {!compactSidebar && (
          <div className="border-border border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="cms-navigation-search"
                type="search"
                className="admin-theme-search-input h-9 border-input bg-card pl-9 pr-8 text-primary placeholder:text-muted-foreground"
                value={navigationQuery}
                onChange={(event) => setNavigationQuery(event.target.value)}
                placeholder="Search menu…"
                aria-label="Search CMS navigation"
                onKeyDown={(event) => { if (event.key === 'Escape') setNavigationQuery('') }}
              />
              {navigationQuery && (
                <Button className="absolute right-1 top-1/2 size-7 -translate-y-1/2" variant="ghost" size="icon" aria-label="Clear navigation search" onClick={() => setNavigationQuery('')}>
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {renderNavigation()}

        <div className={cn('grid gap-2 border-border border-t p-3', compactSidebar && 'px-2')}>
          <Link href="/" target="_blank" rel="noreferrer" title="Open public website" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start', compactSidebar && 'justify-center px-0')}>
            <Globe aria-hidden="true" />
            {!compactSidebar && <><span>View website</span><ExternalLink className="ml-auto size-3.5" aria-hidden="true" /></>}
          </Link>
          <Button type="button" variant="ghost" className={cn('w-full justify-start text-muted-foreground hover:text-primary', compactSidebar && 'justify-center px-0')} disabled={loggingOut} onClick={() => void logout()} title={compactSidebar ? 'Sign out' : undefined}>
            <LogOut aria-hidden="true" />
            {!compactSidebar && <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>}
          </Button>
        </div>
      </AdminNavigationSidebar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminWorkspaceHeader
          current={current}
          userEmail={userEmail}
          providerHealth={providerHealth}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={() => { setCollapsed((value) => !value); setNavigationQuery('') }}
          onOpenMobileNavigation={() => setMobileOpenRoute(routeKey)}
        />

        {showProviderBanner && (
          <div className={cn(
            'flex items-start gap-2 border-border border-b px-4 py-3 text-sm',
            providerHealth.mode === 'google-drive-read-only' ? 'border border-warning/30 bg-warning/10 text-warning' : 'border border-destructive/30 bg-destructive/10 text-destructive',
          )} role={providerHealth.mode === 'unavailable' ? 'alert' : 'status'} aria-live="polite">
            <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {providerHealth.mode === 'google-drive-read-only' ? (
              <p className="m-0"><strong>Read-only recovery mode.</strong> Google Drive snapshots are serving CMS reads. Editing, uploads, account changes and transactional submissions require Neon to recover.</p>
            ) : (
              <p className="m-0"><strong>Data provider unavailable.</strong> The primary database and a usable Google Drive snapshot could not be verified. Avoid submitting changes.</p>
            )}
          </div>
        )}

        <AdminViewportGrid
          title={current}
          dirty={dirty}
          execution={execution}
          layout="single"
        >
          {children}
        </AdminViewportGrid>

        <AdminProviderFooter providerHealth={providerHealth}>
          <span>Website CMS</span>
          <span>Srizony Foundation · Content management</span>
        </AdminProviderFooter>
      </div>
    </AdminAppShell>
  )
}
