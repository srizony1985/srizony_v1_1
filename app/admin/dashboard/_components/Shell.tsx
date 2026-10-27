'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Briefcase, Building2, ChevronDown, ChevronRight, Database, FileSpreadsheet, FileText, Inbox, LayoutDashboard, LogOut, Mail, Menu, Network, Palette, Settings, ShieldCheck, Users, X, PanelsTopLeft, House } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { adminLogout } from '@/lib/api/auth'

export type AdminNavItem = { label: string; href: string; icon?: LucideIcon }
export type AdminNavGroup =
  | { kind: 'link'; key: string; label: string; icon: LucideIcon; href: string }
  | { kind: 'group'; key: string; label: string; icon: LucideIcon; children: readonly AdminNavItem[] }

const GROUPS: readonly AdminNavGroup[] = [
  { kind: 'link', key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard/overview' },
  { kind: 'link', key: 'navigation', label: 'Site Navigation', icon: Network, href: '/admin/dashboard/navigation' },
  { kind: 'link', key: 'landing-page', label: 'Landing Page', icon: House, href: '/admin/dashboard/page-builder?slug=%2F' },
  { kind: 'link', key: 'content', label: 'Site Content', icon: FileText, href: '/admin/dashboard/site-content' },
  { kind: 'link', key: 'page-builder', label: 'Page Builder', icon: PanelsTopLeft, href: '/admin/dashboard/page-builder' },
  { kind: 'link', key: 'portfolio', label: 'Portfolio', icon: Building2, href: '/admin/dashboard/portfolio' },
  { kind: 'link', key: 'visitors', label: 'Visitors', icon: Users, href: '/admin/dashboard/reports/visitors' },
  { kind: 'link', key: 'subscribers', label: 'Subscribers', icon: Mail, href: '/admin/dashboard/reports/newsletter' },
  { kind: 'link', key: 'contacts', label: 'Contact Requests', icon: Inbox, href: '/admin/dashboard/reports/submissions' },
  { kind: 'link', key: 'jobs', label: 'Jobs', icon: Briefcase, href: '/admin/dashboard/jobs' },
  {
    kind: 'group',
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'CMS Users', href: '/admin/dashboard/settings?view=users', icon: Users },
      { label: 'Site Theme', href: '/admin/dashboard/settings?view=theme', icon: Palette },
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

export default function Shell({ userEmail, children }: { userEmail?: string; children: ReactNode }) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [dataProvider, setDataProvider] = useState<'neon' | 'google-drive'>('neon')
  const [providerBusy, setProviderBusy] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
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
    let cancelled = false
    fetch('/api/admin/data-provider', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to load data provider.')
        if (!cancelled) setDataProvider(payload.selected === 'google-drive' ? 'google-drive' : 'neon')
      })
      .catch(() => { if (!cancelled) setProviderMessage('Provider status unavailable') })
    return () => { cancelled = true }
  }, [])

  async function changeDataProvider(provider: 'neon' | 'google-drive') {
    if (provider === dataProvider || providerBusy) return
    setProviderBusy(true)
    setProviderMessage('')
    try {
      const response = await fetch('/api/admin/data-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, verifyDrive: provider === 'google-drive' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to switch data provider.')
      setDataProvider(provider)
      setProviderMessage(provider === 'google-drive' ? 'Drive selected for document-store operations' : 'Neon selected for document-store operations')
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : 'Unable to switch data provider.')
    } finally {
      setProviderBusy(false)
    }
  }
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

  async function logout() {
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
                  title={collapsed ? group.label : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={17} />
                  {!collapsed && <span>{group.label}</span>}
                </Link>
              </section>
            )
          }

          return (
            <section className="admin-nav-group" key={group.key}>
              <button
                type="button"
                title={collapsed ? group.label : undefined}
                className={`admin-nav-parent ${active ? 'active' : ''}`}
                onClick={() => {
                  if (collapsed) setCollapsed(false)
                  else toggleGroup(group.key)
                }}
                aria-expanded={!collapsed ? isExpanded : undefined}
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
                        onClick={() => setMobileOpen(false)}
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
            <label className="admin-provider-select" title="Choose the CMS document-store preference">
              <Database size={15} aria-hidden="true" />
              <span className="admin-provider-label">Data store</span>
              <select
                aria-label="CMS data store"
                value={dataProvider}
                disabled={providerBusy}
                onChange={(event) => void changeDataProvider(event.target.value as 'neon' | 'google-drive')}
              >
                <option value="neon">Neon PostgreSQL</option>
                <option value="google-drive">Google Drive JSON</option>
              </select>
            </label>
            <div className="admin-header-user">
              <span className="admin-header-user-icon"><ShieldCheck size={15} /></span>
              <span>{userEmail || 'CMS administrator'}</span>
            </div>
            {providerMessage && <span className="admin-provider-status" role="status">{providerMessage}</span>}
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
