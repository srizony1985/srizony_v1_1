'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { Briefcase, Building2, ChevronDown, ChevronRight, Database, Workflow, FileSpreadsheet, FileText, LayoutDashboard, LogOut, Menu, Network, Settings, ShieldCheck, Users, X, PanelsTopLeft, Globe, RefreshCw, Save, Sun, Moon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { adminLogout } from '@/lib/api/auth'
import { AdminActionProvider, useAdminActions } from './AdminActionContext'
import { useAdminTheme } from '../../AdminThemeShell'
import { Button } from '@/components/ui/button'

export type AdminNavItem = { label: string; href: string; icon?: LucideIcon }
export type AdminNavGroup =
  | { kind: 'link'; key: string; label: string; icon: LucideIcon; href: string }
  | { kind: 'group'; key: string; label: string; icon: LucideIcon; children: readonly AdminNavItem[] }

const GROUPS: readonly AdminNavGroup[] = [
  { kind: 'link', key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard/overview' },
  { kind: 'link', key: 'navigation', label: 'Site Navigation', icon: Network, href: '/admin/dashboard/navigation' },
  { kind: 'link', key: 'content', label: 'Site Content', icon: FileText, href: '/admin/dashboard/site-content' },
  { kind: 'link', key: 'page-builder', label: 'Page Builder', icon: PanelsTopLeft, href: '/admin/dashboard/page-builder' },
  { kind: 'link', key: 'portfolio', label: 'Portfolio', icon: Building2, href: '/admin/dashboard/portfolio' },
  { kind: 'link', key: 'visitors', label: 'Visitors', icon: Users, href: '/admin/dashboard/reports/visitors' },
  { kind: 'link', key: 'jobs', label: 'Jobs', icon: Briefcase, href: '/admin/dashboard/jobs' },
  { kind: 'link', key: 'website-essentials', label: 'Website Essentials', icon: Globe, href: '/admin/dashboard/website-essentials' },
  { kind: 'link', key: 'cms-pipeline', label: 'CMS Data Pipeline', icon: Workflow, href: '/admin/dashboard/cms-pipeline' },
  {
    kind: 'group',
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'CMS Users', href: '/admin/dashboard/settings?view=users', icon: Users },
      { label: 'Database & APIs', href: '/admin/dashboard/settings?view=database', icon: Database },
      { label: 'Reporting', href: '/admin/dashboard/settings?view=reporting', icon: FileSpreadsheet },
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
  return pathname.startsWith('/admin/dashboard') ? 'Dashboard' : 'CMS'
}

function AdminHeaderActions() {
  const { hasSave, hasReload, dirty, saving, runSave, runReload } = useAdminActions()
  const { mode, setMode } = useAdminTheme()
  const [reloading, setReloading] = useState(false)

  async function reload() {
    if (dirty && !window.confirm('Reload CMS data and discard unsaved changes in the open editors?')) return
    setReloading(true)
    try {
      if (hasReload) await runReload()
      else window.location.reload()
    } finally {
      setReloading(false)
    }
  }

  return (
    <div className="admin-global-actions" aria-label="CMS actions">
      <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={reloading} title="Reload current CMS data">
        <RefreshCw size={15} className={reloading ? 'admin-spin' : ''} /><span>Reload</span>
      </Button>
      <Button type="button" size="sm" onClick={() => void runSave()} disabled={!hasSave || !dirty || saving} title={dirty ? 'Save all unsaved changes in the open editors' : 'There are no unsaved changes'}>
        <Save size={15} /><span>{saving ? 'Saving…' : 'Save all'}</span>{dirty && <i className="admin-unsaved-dot" aria-label="Unsaved changes" />}
      </Button>
      <span className="admin-header-action-divider" aria-hidden="true" />
      <button type="button" className="admin-mode-toggle" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
        {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        <span>{mode === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
    </div>
  )
}

export default function Shell(props: { userEmail?: string; children: ReactNode }) {
  return <AdminActionProvider><ShellContent {...props} /></AdminActionProvider>
}

function ShellContent({ userEmail, children }: { userEmail?: string; children: ReactNode }) {
  const { dirty } = useAdminActions()
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ settings: true })

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sf-admin-sidebar') === 'collapsed')
      const saved = localStorage.getItem('sf-admin-groups')
      if (saved) setExpanded((current) => ({ ...current, ...JSON.parse(saved) }))
    } catch {
      // Optional preference storage.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sf-admin-sidebar', collapsed ? 'collapsed' : 'expanded')
      localStorage.setItem('sf-admin-groups', JSON.stringify(expanded))
    } catch {
      // Optional preference storage.
    }
  }, [collapsed, expanded])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, searchParams])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  const current = useMemo(() => titleFromRoute(pathname, searchParams), [pathname, searchParams])

  function handleNavLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return
    const destination = new URL(event.currentTarget.href, window.location.href)
    const currentUrl = new URL(window.location.href)
    const changesRoute = destination.pathname !== currentUrl.pathname || destination.search !== currentUrl.search
    if (dirty && changesRoute && !window.confirm('You have unsaved CMS changes. Leave this page and discard them?')) {
      event.preventDefault()
      return
    }
    setMobileOpen(false)
  }

  async function logout() {
    if (dirty && !window.confirm('You have unsaved CMS changes. Sign out and discard them?')) return
    setLoggingOut(true)
    try {
      await adminLogout()
    } finally {
      router.replace('/admin/login')
      router.refresh()
    }
  }

  function toggleGroup(key: string) {
    setExpanded((currentState) => ({ ...currentState, [key]: !currentState[key] }))
  }

  function renderBrand(expandedBrand: boolean) {
    return (
      <div className="admin-sidebar-brand">
        <div className="admin-brand-logo">
          <a href="https://scarletlabs.tech">
            <Image src="/images/sl-logo.png" alt="SL" width={30} height={30} priority />
          </a>
        </div>
        {expandedBrand && (
          <div className="admin-brand-copy">
            <strong>CMS by</strong>
            <small>Scarlet Labs</small>
          </div>
        )}
        <button
          className="admin-collapse"
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <Menu size={17} />
        </button>
        <button className="admin-mobile-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
          <X size={18} />
        </button>
      </div>
    )
  }

  function renderNavigation() {
    return (
      <nav className="admin-sidebar-nav" aria-label="CMS navigation">
        {GROUPS.map((group) => {
          const Icon = group.icon
          const active = group.kind === 'link'
            ? isActivePath(pathname, searchParams, group.href)
            : parentIsActive(pathname, searchParams, group.children)
          const isExpanded = group.kind === 'group' ? Boolean(expanded[group.key]) : false

          if (group.kind === 'link') {
            return (
              <section className="admin-nav-group" key={group.key}>
                <Link
                  href={group.href}
                  className={`admin-nav-parent ${active ? 'active' : ''}`}
                  data-nav-label={group.label}
                  title={collapsed ? group.label : undefined}
                  onClick={handleNavLinkClick}
                >
                  <Icon size={17} />
                  {!collapsed && <span>{group.label}</span>}
                </Link>
              </section>
            )
          }

          return (
            <section className="admin-nav-group" key={group.key}
              onMouseEnter={() => { if (!collapsed && typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) setExpanded((state) => ({ ...state, [group.key]: true })) }}
              onMouseLeave={() => { if (!collapsed && typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches && !active) setExpanded((state) => ({ ...state, [group.key]: false })) }}
            >
              <button
                type="button"
                title={collapsed ? group.label : undefined}
                className={`admin-nav-parent ${active ? 'active' : ''}`}
                data-nav-label={group.label}
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setExpanded((currentState) => ({ ...currentState, [group.key]: true })) }
                  else toggleGroup(group.key)
                }}
                aria-expanded={!collapsed ? isExpanded : undefined}
                onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) { if (collapsed) setCollapsed(false); setExpanded((state) => ({ ...state, [group.key]: true })) } }}
              >
                <Icon size={17} />
                {!collapsed && (
                  <>
                    <span>{group.label}</span>
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </>
                )}
              </button>
              {!collapsed && isExpanded && (
                <div className="admin-nav-children">
                  {group.children.map((item) => {
                    const ItemIcon = item.icon
                    const itemActive = isActivePath(pathname, searchParams, item.href)
                    return (
                      <Link
                        href={item.href}
                        key={item.href}
                        className={itemActive ? 'active' : ''}
                        onClick={handleNavLinkClick}
                      >
                        {ItemIcon && <ItemIcon size={13} aria-hidden="true" />}
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </nav>
    )
  }

  return (
    <div className={`admin-shell ${collapsed ? 'admin-collapsed' : ''} ${mobileOpen ? 'admin-mobile-open' : ''}`}>
      <button className="admin-mobile-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <aside className="admin-sidebar">
        {renderBrand(!collapsed)}
        {renderNavigation()}
        <div className="admin-sidebar-footer">
          <div className="admin-powered">
            <small>CMS powered by</small>
            <a href="https://scarletlabs.tech" target="_blank" rel="noreferrer noopener">Scarlet Labs</a>
          </div>
          <button type="button" className="admin-logout-button ui-button ui-button-outline ui-button-sm" disabled={loggingOut} onClick={() => void logout()}>
            <LogOut size={15} />
            {!collapsed && (loggingOut ? 'Signing out…' : 'Sign out')}
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-header">
          <div className="admin-header-left">
            <button className="admin-mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu size={19} />
            </button>
            <div className="admin-brand-logo">
              <Image src="/images/Logo-SF.png" alt="Srizony Foundation" width={30} height={30} priority />
            </div>
              <div className="admin-brand-copy">
                <strong>Srizony Foundation</strong>
                <small>CMS management</small>
              </div>
          </div>
          <div className="admin-header-tools">
            <AdminHeaderActions />
            <div className="admin-provider-select" aria-label="CMS data source">
              <Database size={15} aria-hidden="true" />
              <span className="admin-provider-label">Data source</span>
              <strong>Neon PostgreSQL</strong>
            </div>
            <div className="admin-header-user">
              <span className="admin-header-user-icon"><ShieldCheck size={15} /></span>
              <span>{userEmail || 'CMS administrator'}</span>
            </div>
          </div>
        </header>

        <main className="admin-main">{children}</main>

        <footer className="admin-footer">
          <span>CMS powered by</span>
          <a href="https://scarletlabs.tech" target="_blank" rel="noreferrer noopener"><strong>Scarlet Labs</strong></a>
        </footer>
      </div>
    </div>
  )
}
