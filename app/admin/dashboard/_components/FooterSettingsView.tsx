'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Save, Trash2, LayoutGrid, Link2, GripVertical, Type } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AdminSectionTabs, SectionToolbar } from '../_components/AdminCommon'
import { AdminDataContainer, AdminWorkspaceGrid } from '@/components/admin/cms'
import { useRegisterAdminActions } from '../_components/AdminActionContext'
import { DEFAULT_FOOTER_CONFIG, normalizeFooterConfig, type FooterConfig, type FooterSection, type FooterLink } from '@/lib/footerConfig'
import type { Role } from '@/lib/api/settings'
import type { NavGroupTree, NavNode } from '@/lib/cms/navigation'
import { getAdminNavigationTree, getAdminFooterConfig, saveAdminFooterConfig } from '@/lib/api/adminFooter'

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const newCustomSection = (): FooterSection => ({
  id: makeId('footer-section'), titleEn: 'New links', titleBn: '', enabled: true, kind: 'custom', columns: 1, showAddress: true, showPhones: true, showEmail: true, links: [],
})
const newLink = (): FooterLink => ({ id: makeId('footer-link'), labelEn: 'New link', labelBn: '', href: '/' })
type AvailableSiteLink = { label: string; labelBn: string; href: string }
function flattenSiteLinks(groups: NavGroupTree[]): AvailableSiteLink[] {
  const output: AvailableSiteLink[] = []
  const visit = (items: NavNode[]) => {
    for (const item of items) {
      const href = item.slug || ''
      const label = item.labelEn || ''
      const labelBn = item.labelBn || ''
      if (href && label && item.visible && item.menuType !== 'folder') output.push({ label, labelBn, href })
      visit(item.children)
    }
  }
  for (const group of groups) visit(group.items)
  return [...new Map(output.map((item) => [item.href, item])).values()].sort((a, b) => a.label.localeCompare(b.label))
}

export default function FooterSettingsView({ role }: { role: Role }) {
  const [draft, setDraft] = useState<FooterConfig>(DEFAULT_FOOTER_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [siteLinks, setSiteLinks] = useState<AvailableSiteLink[]>([])
  const [activeFooterLinkIds, setActiveFooterLinkIds] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'layout' | 'typography' | 'sections'>('layout')

  useEffect(() => {
    let active = true
    void getAdminNavigationTree()
      .then((payload) => { if (active) setSiteLinks(flattenSiteLinks(payload.groups ?? [])) })
      .catch(() => { if (active) setSiteLinks([]) })
    void getAdminFooterConfig()
      .then((payload) => {
        if (active) { setDraft(normalizeFooterConfig(payload.footer)); setDirty(false) }
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load footer settings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const enabledSections = useMemo(() => draft.sections.filter((section) => section.enabled).length, [draft.sections])

  function update<K extends keyof FooterConfig>(key: K, value: FooterConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setNotice('')
  }

  function updateTypography<K extends keyof FooterConfig['typography']>(key: K, value: FooterConfig['typography'][K]) {
    setDraft((current) => ({ ...current, typography: { ...current.typography, [key]: value } }))
    setDirty(true)
    setNotice('')
  }

  function updateSection(id: string, patch: Partial<FooterSection>) {
    setDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section) }))
    setDirty(true)
    setNotice('')
  }

  function updateLink(sectionId: string, linkId: string, patch: Partial<FooterLink>) {
    setDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId
      ? { ...section, links: section.links.map((link) => link.id === linkId ? { ...link, ...patch } : link) }
      : section) }))
    setDirty(true)
    setNotice('')
  }

  function moveSection(id: string, direction: -1 | 1) {
    setDraft((current) => {
      const from = current.sections.findIndex((section) => section.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.sections.length) return current
      const sections = [...current.sections]
      ;[sections[from], sections[to]] = [sections[to], sections[from]]
      return { ...current, sections }
    })
    setDirty(true)
    setNotice('')
  }

  function addSection() {
    setDraft((current) => ({ ...current, sections: [...current.sections, newCustomSection()].slice(0, 8) }))
    setDirty(true)
    setNotice('')
  }

  function removeSection(id: string) {
    if (!window.confirm('Remove this footer section? Its custom links will also be removed.')) return
    setDraft((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }))
    setDirty(true)
    setNotice('')
  }

  function save(): Promise<void> {
    if (role === 'analyst') return Promise.resolve()
    setSaving(true)
    setError('')
    setNotice('')
    return saveAdminFooterConfig(draft)
      .then((payload) => {
        setDraft(normalizeFooterConfig(payload.footer ?? draft))
        setDirty(false)
        setNotice('Footer layout saved and published.')
        toast.success('Footer settings saved.')
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save footer settings.'
        setError(message)
        toast.error(message)
      })
      .finally(() => setSaving(false))
  }

  function refresh() {
    if (dirty && !window.confirm('Reload footer settings and discard unsaved changes?')) return
    window.location.reload()
  }

  useRegisterAdminActions('footer-navigation', {
    save,
    reload: () => window.location.reload(),
    dirty: dirty && !loading,
    saving,
    label: 'Footer Navigation',
  })

  return (
    <AdminWorkspaceGrid layout="single" ariaLabel="Footer navigation settings">
      <AdminDataContainer
        label="Footer navigation workspace"
        bodyScroll="auto"
        height="min(84dvh, 920px)"
        minHeight="360px"
      >
        <div className="settings-footer-view [display:grid] [gap:12px] [min-width:0] [&_>_[data-slot=card]]:[min-width:0] [&_>_[data-slot=card]]:[overflow:hidden] [&_>_[data-slot=card]]:[border-color:var(--border)] [&_>_[data-slot=card]]:[background:var(--card)] [&_>_[data-slot=card]]:[color:var(--foreground)] [&_[data-slot=card-title]]:[color:var(--foreground,_var(--foreground))] [&_[data-slot=card-title]]:[font-family:var(--font-sans)] [&_[data-slot=card-title]]:[font-size:1rem] [&_[data-slot=card-title]]:[line-height:1.25] [&_[data-slot=card-description]]:[color:var(--muted-foreground)] [&_[data-slot=card-description]]:[font-family:var(--font-sans)] [&_[data-slot=card-description]]:[font-size:0.75rem] [&_[data-slot=card-description]]:[line-height:1.4] [&_[data-slot=card-content]]:[min-width:0] [&_.settings-theme-actions]:[padding-top:10px] [&_.settings-theme-actions]:[border-top:1px_solid_var(--border)] [&_.cms-save-error]:[margin-bottom:10px] max-[620px]:[&_.settings-theme-actions_[data-slot=button]]:[width:100%]">
    <SectionToolbar
      title="Footer Navigation"
      tabs={<AdminSectionTabs
        label="Footer settings sections"
        value={activeTab}
        onChange={(next) => setActiveTab(next as 'layout' | 'typography' | 'sections')}
        items={[
          { value: 'layout', label: 'Layout & Content', icon: <LayoutGrid size={15} /> },
          { value: 'typography', label: 'Typography', icon: <Type size={15} /> },
          { value: 'sections', label: 'Sections', icon: <Link2 size={15} />, count: draft.sections.length },
        ]}
      />}
      onRefresh={refresh}
      refreshing={loading}
      actions={role === 'analyst' ? <Badge variant="outline">Read only</Badge> : <Button type="button" onClick={() => void save()} disabled={saving || loading}><Save size={15} />{saving ? 'Saving…' : 'Save footer'}</Button>}
    />
    {error && <div className="cms-save-error [display:grid] [gap:4px] [margin-top:14px] [padding:12px_14px] [border:1px_solid_color-mix(in_srgb,var(--destructive)_28%,var(--border))] [border-left:4px_solid_var(--destructive)] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--destructive)_6%,var(--card))] [color:var(--foreground)] [&_strong]:[font-size:0.875rem] [&_span]:[font-size:0.875rem] [&_span]:[overflow-wrap:anywhere] [&_small]:[font-size:0.75rem] [&_small]:[color:var(--muted-foreground)]" role="alert">{error}</div>}
    {notice && <div className="settings-theme-notice [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [justify-content:flex-start] [margin-top:12px] [padding:9px_11px] [border:1px_solid_color-mix(in_srgb,_var(--success)_30%,_var(--border))] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,_var(--success)_8%,_var(--card))] [color:var(--success)] [font-size:0.75rem] [line-height:1.5] [&_svg]:[flex:0_0_auto]" role="status"><Check size={15} />{notice}</div>}
    {loading ? <Card><CardContent><p className="admin-small-note">Loading footer configuration…</p></CardContent></Card> : <>
    <div hidden={activeTab !== 'layout'}>
    <Card>
      <CardHeader className="settings-panel-header [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:13px] [padding-bottom:11px] [&_[data-slot=card-title]]:[color:var(--foreground)] [&_[data-slot=card-title]]:[font-size:1rem] [&_[data-slot=card-title]]:[line-height:1.25] [&_[data-slot=card-description]]:[color:var(--muted-foreground)] [&_[data-slot=card-description]]:[font-size:0.75rem] [&_[data-slot=card-description]]:[line-height:1.4] max-[760px]:[align-items:flex-start] max-[520px]:[flex-direction:column]">
        <div className="settings-panel-title-wrap [display:flex] [align-items:flex-start] [gap:10px] [min-width:0] [&>div]:[display:grid] [&>div]:[gap:3px] [&>div]:[min-width:0]">
          <span className="settings-panel-icon [width:32px] [height:32px] [flex:0_0_auto] [display:grid] [place-items:center] [border-radius:var(--radius)] [background:var(--muted)] [color:var(--primary)]"><LayoutGrid size={17} /></span>
          <div><CardTitle>Footer layout and content</CardTitle><CardDescription>Control which footer areas appear, how many layout columns are used, and how link groups are balanced.</CardDescription></div>
        </div>
        <Badge variant={draft.enabled ? 'default' : 'outline'}>{draft.enabled ? 'Visible on website' : 'Hidden on website'}</Badge>
      </CardHeader>
      <CardContent>
          <div className="settings-footer-global-grid [display:grid] [grid-template-columns:minmax(220px,_.8fr)_minmax(220px,_1.2fr)] [gap:11px] [align-items:start] [&_>_.cms-field]:[display:grid] [&_>_.cms-field]:[gap:6px] [&_>_.cms-field]:[margin:0] [&_>_.cms-field]:[min-width:0] [&_>_.cms-field_>_span]:[color:var(--foreground)] [&_>_.cms-field_>_span]:[font-size:0.875rem] [&_>_.cms-field_>_span]:[font-weight:600] [&_>_.cms-field_>_small]:[color:var(--muted-foreground)] [&_>_.cms-field_>_small]:[font-size:0.875rem] [&_>_.cms-field_>_small]:[line-height:1.35] [&_[data-slot=native-select]]:[width:100%] [&_[data-slot=native-select]]:[min-height:37px] max-[620px]:[grid-template-columns:minmax(0,_1fr)]">
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed] settings-footer-toggle--wide [min-height:100%]"><Checkbox checked={draft.enabled} onChange={(event) => update('enabled', event.target.checked)} disabled={role === 'analyst' || saving} /><span><strong>Show website footer</strong><small>Hide the entire footer without deleting its content configuration.</small></span></label>
            <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Overall footer columns</span><NativeSelect value={draft.layoutColumns} onChange={(event) => update('layoutColumns', Number(event.target.value))} disabled={role === 'analyst' || saving}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} columns</option>)}</NativeSelect><small>Controls the desktop grid for the brand area and enabled footer sections.</small></label>
          </div>
          <div className="settings-footer-options [display:grid] [grid-template-columns:repeat(3,_minmax(0,_1fr))] [gap:8px] [margin-top:12px] max-[900px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[620px]:[grid-template-columns:minmax(0,_1fr)]" aria-label="Footer content visibility">
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={draft.showBrand} onChange={(event) => update('showBrand', event.target.checked)} disabled={role === 'analyst' || saving} /><span><strong>Brand area</strong><small>Show the organization identity block.</small></span></label>
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={draft.showLogo} onChange={(event) => update('showLogo', event.target.checked)} disabled={role === 'analyst' || saving || !draft.showBrand} /><span><strong>Logo</strong><small>Show the site logo beside its name.</small></span></label>
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={draft.showTagline} onChange={(event) => update('showTagline', event.target.checked)} disabled={role === 'analyst' || saving || !draft.showBrand} /><span><strong>Tagline</strong><small>Show the brand tagline.</small></span></label>
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={draft.showSummary} onChange={(event) => update('showSummary', event.target.checked)} disabled={role === 'analyst' || saving || !draft.showBrand} /><span><strong>Brand summary</strong><small>Show the organization summary text.</small></span></label>
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={draft.showSocial} onChange={(event) => update('showSocial', event.target.checked)} disabled={role === 'analyst' || saving || !draft.showBrand} /><span><strong>Social links</strong><small>Show the social profiles in the brand area.</small></span></label>
            <label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={draft.showCopyright} onChange={(event) => update('showCopyright', event.target.checked)} disabled={role === 'analyst' || saving} /><span><strong>Copyright line</strong><small>Show the copyright strip at the bottom.</small></span></label>
          </div>
      </CardContent>
    </Card>
    </div>

    <div hidden={activeTab !== 'typography'}>
    <Card>
      <CardHeader className="settings-panel-header [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:13px] [padding-bottom:11px] [&_[data-slot=card-title]]:[color:var(--foreground)] [&_[data-slot=card-title]]:[font-size:1rem] [&_[data-slot=card-title]]:[line-height:1.25] [&_[data-slot=card-description]]:[color:var(--muted-foreground)] [&_[data-slot=card-description]]:[font-size:0.75rem] [&_[data-slot=card-description]]:[line-height:1.4] max-[760px]:[align-items:flex-start] max-[520px]:[flex-direction:column]">
        <div className="settings-panel-title-wrap [display:flex] [align-items:flex-start] [gap:10px] [min-width:0] [&>div]:[display:grid] [&>div]:[gap:3px] [&>div]:[min-width:0]"><span className="settings-panel-icon [width:32px] [height:32px] [flex:0_0_auto] [display:grid] [place-items:center] [border-radius:var(--radius)] [background:var(--muted)] [color:var(--primary)]"><Type size={17} /></span><div><CardTitle>Footer typography</CardTitle><CardDescription>Customize footer headings, links and supporting text independently while keeping the site&apos;s single theme.</CardDescription></div></div>
      </CardHeader>
      <CardContent>
        <div className="settings-footer-typo-grid [display:grid] [grid-template-columns:repeat(4,minmax(0,1fr))] [gap:10px] [&_.cms-field]:[display:grid] [&_.cms-field]:[gap:5px] [&_.cms-field]:[min-width:0] [&_.cms-field]:[margin:0] [&_.cms-field>span]:[color:var(--foreground)] [&_.cms-field>span]:[font-size:0.875rem] [&_.cms-field>span]:[font-weight:600] [&_[data-slot=input]]:[width:100%] [&_[data-slot=input]]:[min-height:35px] [&_[data-slot=native-select]]:[width:100%] [&_[data-slot=native-select]]:[min-height:35px] max-[900px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[620px]:[grid-template-columns:minmax(0,1fr)]">
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section title font</span><NativeSelect value={draft.typography.titleFontFamily} onChange={(event) => updateTypography('titleFontFamily', event.target.value)} disabled={role === 'analyst' || saving}>{[['inherit','Theme display font'],['system','System UI'],['arial','Arial'],['georgia','Georgia'],['times','Times New Roman'],['inter','Inter'],['roboto','Roboto'],['noto-sans-bengali','Noto Sans Bengali']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section title size</span><Input type="number" min={12} max={32} value={draft.typography.titleSize} onChange={(event) => updateTypography('titleSize', Number(event.target.value))} disabled={role === 'analyst' || saving} /></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section title weight</span><NativeSelect value={draft.typography.titleWeight} onChange={(event) => updateTypography('titleWeight', Number(event.target.value))} disabled={role === 'analyst' || saving}>{[400,500,600,700,800,900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</NativeSelect></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section title colour</span><Input className="settings-footer-color h-9 w-full cursor-pointer p-1" type="color" value={draft.typography.titleColor} onChange={(event) => updateTypography('titleColor', event.target.value)} disabled={role === 'analyst' || saving} /></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Link size</span><Input type="number" min={11} max={22} value={draft.typography.linkSize} onChange={(event) => updateTypography('linkSize', Number(event.target.value))} disabled={role === 'analyst' || saving} /></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Link weight</span><NativeSelect value={draft.typography.linkWeight} onChange={(event) => updateTypography('linkWeight', Number(event.target.value))} disabled={role === 'analyst' || saving}>{[300,400,500,600,700,800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</NativeSelect></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Link colour</span><Input className="settings-footer-color h-9 w-full cursor-pointer p-1" type="color" value={draft.typography.linkColor} onChange={(event) => updateTypography('linkColor', event.target.value)} disabled={role === 'analyst' || saving} /></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Supporting text font</span><NativeSelect value={draft.typography.bodyFontFamily} onChange={(event) => updateTypography('bodyFontFamily', event.target.value)} disabled={role === 'analyst' || saving}>{[['inherit','Theme body font'],['system','System UI'],['arial','Arial'],['georgia','Georgia'],['times','Times New Roman'],['inter','Inter'],['roboto','Roboto'],['noto-sans-bengali','Noto Sans Bengali']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Supporting text size</span><Input type="number" min={11} max={22} value={draft.typography.bodySize} onChange={(event) => updateTypography('bodySize', Number(event.target.value))} disabled={role === 'analyst' || saving} /></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Supporting text colour</span><Input className="settings-footer-color h-9 w-full cursor-pointer p-1" type="color" value={draft.typography.bodyColor} onChange={(event) => updateTypography('bodyColor', event.target.value)} disabled={role === 'analyst' || saving} /></label>
        </div>
        <p className="settings-footer-hint [margin:9px_0_0] [color:var(--muted-foreground)] [font-size:0.75rem] [line-height:1.4]">Colour controls are applied to the footer only. Keep sufficient contrast between text and the footer background.</p>
      </CardContent>
    </Card>
    </div>

    <div hidden={activeTab !== 'sections'}>
    <Card>
      <CardHeader className="settings-panel-header [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:13px] [padding-bottom:11px] [&_[data-slot=card-title]]:[color:var(--foreground)] [&_[data-slot=card-title]]:[font-size:1rem] [&_[data-slot=card-title]]:[line-height:1.25] [&_[data-slot=card-description]]:[color:var(--muted-foreground)] [&_[data-slot=card-description]]:[font-size:0.75rem] [&_[data-slot=card-description]]:[line-height:1.4] max-[760px]:[align-items:flex-start] max-[520px]:[flex-direction:column]">
        <div className="settings-panel-title-wrap [display:flex] [align-items:flex-start] [gap:10px] [min-width:0] [&>div]:[display:grid] [&>div]:[gap:3px] [&>div]:[min-width:0]"><span className="settings-panel-icon [width:32px] [height:32px] [flex:0_0_auto] [display:grid] [place-items:center] [border-radius:var(--radius)] [background:var(--muted)] [color:var(--primary)]"><Link2 size={17} /></span><div><CardTitle>Footer sections</CardTitle><CardDescription>Add, remove, hide or configure the sections displayed beside the brand area. Each section can have its own link-column count.</CardDescription></div></div>
        <div className="settings-footer-section-count [display:grid] [justify-items:end] [gap:2px] [flex:0_0_auto] [color:var(--muted-foreground)] [font-size:0.75rem] [white-space:nowrap] [&_strong]:[color:var(--primary)] [&_strong]:[font-size:1.125rem] [&_strong]:[line-height:1] [&_strong]:[font-variant-numeric:tabular-nums]"><strong>{draft.sections.length}</strong><span>total · {enabledSections} visible</span></div>
      </CardHeader>
      <CardContent>
        {!loading && <div className="settings-footer-section-list [display:grid] [gap:10px]">
          {draft.sections.map((section, index) => <section className="settings-footer-section-editor [min-width:0] [padding:11px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] max-[620px]:[padding:9px]" key={section.id}>
            <header className="settings-footer-section-editor-head [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [margin-bottom:10px] max-[620px]:[align-items:flex-start]">
              <div className="settings-footer-section-index [display:inline-flex] [align-items:center] [gap:7px] [min-width:0] [color:var(--muted-foreground)] [font-size:0.75rem] [font-weight:600] [&_svg]:[color:var(--primary)]"><GripVertical size={14} /><span>Section {index + 1}</span></div>
              <div className="settings-footer-section-actions [display:flex] [align-items:center] [gap:4px] [flex-wrap:wrap] [justify-content:flex-end] max-[620px]:[gap:3px]">
                <div className="settings-footer-order-actions [display:flex] [align-items:center] [gap:4px] [&_[data-slot=button]]:[width:27px] [&_[data-slot=button]]:[min-width:27px] [&_[data-slot=button]]:[height:27px] [&_[data-slot=button]]:[min-height:27px] [&_[data-slot=button]]:[padding:0]"><Button type="button" size="icon" variant="ghost" onClick={() => moveSection(section.id, -1)} disabled={role === 'analyst' || saving || index === 0} aria-label={`Move section ${index + 1} up`}><ChevronUp size={14} /></Button><Button type="button" size="icon" variant="ghost" onClick={() => moveSection(section.id, 1)} disabled={role === 'analyst' || saving || index === draft.sections.length - 1} aria-label={`Move section ${index + 1} down`}><ChevronDown size={14} /></Button></div>
                <label className="settings-footer-visibility [display:inline-flex] [align-items:center] [gap:5px] [min-height:28px] [padding:4px_7px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [color:var(--muted-foreground)] [font-size:0.75rem] [font-weight:600] [cursor:pointer] [&_input]:[width:13px] [&_input]:[height:13px] [&_input]:[margin:0] [&_input]:[accent-color:var(--primary)] [&_svg]:[color:var(--primary)]"><Checkbox checked={section.enabled} onChange={(event) => updateSection(section.id, { enabled: event.target.checked })} disabled={role === 'analyst' || saving} />{section.enabled ? <Eye size={14} /> : <EyeOff size={14} />}<span>{section.enabled ? 'Visible' : 'Hidden'}</span></label>
                <Button type="button" size="sm" variant="outline" onClick={() => removeSection(section.id)} disabled={role === 'analyst' || saving} aria-label={`Remove footer section ${index + 1}`}><Trash2 size={14} />Remove</Button>
              </div>
            </header>
            <div className="settings-footer-section-fields [display:grid] [grid-template-columns:repeat(4,_minmax(0,_1fr))] [gap:9px] [&_.cms-field]:[display:grid] [&_.cms-field]:[gap:5px] [&_.cms-field]:[min-width:0] [&_.cms-field]:[margin:0] [&_.cms-field_>_span]:[color:var(--muted-foreground)] [&_.cms-field_>_span]:[font-size:0.875rem] [&_.cms-field_>_span]:[font-weight:600] [&_[data-slot=input]]:[width:100%] [&_[data-slot=input]]:[min-height:35px] [&_[data-slot=input]]:[font-size:0.875rem] [&_[data-slot=native-select]]:[width:100%] [&_[data-slot=native-select]]:[min-height:35px] [&_[data-slot=native-select]]:[font-size:0.875rem] max-[900px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[620px]:[grid-template-columns:minmax(0,_1fr)]">
              <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section title (English)</span><Input value={section.titleEn} onChange={(event) => updateSection(section.id, { titleEn: event.target.value })} disabled={role === 'analyst' || saving} maxLength={100} /></label>
              <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section title (বাংলা)</span><Input value={section.titleBn} onChange={(event) => updateSection(section.id, { titleBn: event.target.value })} disabled={role === 'analyst' || saving} maxLength={100} /></label>
              <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section type</span><NativeSelect value={section.kind} onChange={(event) => updateSection(section.id, { kind: event.target.value as FooterSection['kind'] })} disabled={role === 'analyst' || saving}><option value="navigation">Website navigation links</option><option value="custom">Custom links</option><option value="contact">Contact information</option></NativeSelect></label>
              <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Columns inside this section</span><NativeSelect value={section.columns} onChange={(event) => updateSection(section.id, { columns: Number(event.target.value) })} disabled={role === 'analyst' || saving || section.kind === 'contact'}>{[1,2,3,4].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'column' : 'columns'}</option>)}</NativeSelect></label>
            </div>
            {section.kind === 'navigation' && <p className="settings-footer-hint [margin:9px_0_0] [color:var(--muted-foreground)] [font-size:0.75rem] [line-height:1.4]">Links are generated from visible website navigation entries. The links are split evenly across the selected columns to avoid long, unbalanced lists.</p>}
            {section.kind === 'contact' && <div className="settings-footer-contact-options [display:flex] [align-items:center] [flex-wrap:wrap] [gap:7px] [margin-top:9px] [&_.settings-footer-toggle]:[min-width:120px] [&_.settings-footer-toggle]:[padding:7px_9px] [&_.settings-footer-hint]:[width:100%] [&_.settings-footer-hint]:[margin-top:0]"><span className="settings-footer-subheading [width:100%] [color:var(--foreground)] [font-size:0.75rem] [font-weight:600]">Contact details to display</span><label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={section.showAddress} onChange={(event) => updateSection(section.id, { showAddress: event.target.checked })} disabled={role === 'analyst' || saving} /><span><strong>Address</strong></span></label><label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={section.showPhones} onChange={(event) => updateSection(section.id, { showPhones: event.target.checked })} disabled={role === 'analyst' || saving} /><span><strong>Phone numbers</strong></span></label><label className="settings-footer-toggle [min-width:0] [display:flex] [align-items:flex-start] [gap:8px] [padding:9px_10px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)] [color:var(--foreground)] [cursor:pointer] [&_input]:[flex:0_0_auto] [&_input]:[width:15px] [&_input]:[height:15px] [&_input]:[margin:2px_0_0] [&_input]:[accent-color:var(--primary)] [&_>_span]:[display:grid] [&_>_span]:[gap:3px] [&_>_span]:[min-width:0] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_strong]:[line-height:1.5] [&_strong]:[font-weight:600] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&:has(input:disabled)]:[opacity:.58] [&:has(input:disabled)]:[cursor:not-allowed]"><Checkbox checked={section.showEmail} onChange={(event) => updateSection(section.id, { showEmail: event.target.checked })} disabled={role === 'analyst' || saving} /><span><strong>Email</strong></span></label><p className="settings-footer-hint [margin:9px_0_0] [color:var(--muted-foreground)] [font-size:0.75rem] [line-height:1.4]">Values are read from Website Essentials / Portfolio contact information.</p></div>}
            {section.kind === 'custom' && <div className="settings-footer-links-editor [display:grid] [gap:8px] [margin-top:12px] [padding-top:10px] [border-top:1px_solid_var(--border)]">
              <div className="settings-footer-links-heading [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [&_>_strong]:[color:var(--foreground)] [&_>_strong]:[font-size:0.75rem] [&_[data-slot=button]]:[min-height:29px] [&_[data-slot=button]]:[font-size:0.875rem] max-[620px]:[align-items:flex-start]"><strong>Custom links</strong><Button type="button" size="sm" variant="outline" onClick={() => { const link = newLink(); updateSection(section.id, { links: [...section.links, link].slice(0, 40) }); setActiveFooterLinkIds((current) => ({ ...current, [section.id]: link.id })) }} disabled={role === 'analyst' || saving || section.links.length >= 40}><Plus size={14} />Add link</Button></div>
              {section.links.length === 0 && <p className="settings-footer-hint [margin:9px_0_0] [color:var(--muted-foreground)] [font-size:0.75rem] [line-height:1.4]">No custom links yet. Add a label and destination for each link.</p>}
              {section.links.length > 0 && (() => {
                const activeLink = section.links.find((link) => link.id === activeFooterLinkIds[section.id]) ?? section.links[0]
                return <div className="grid min-w-0 gap-3">
                  <div className="flex min-w-0 gap-2 overflow-x-auto border-b border-border pb-2" role="tablist" aria-label={`${section.titleEn || 'Footer'} custom links`}>
                    {section.links.map((link, linkIndex) => <Button
                      key={link.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      role="tab"
                      aria-selected={activeLink.id === link.id}
                      className={activeLink.id === link.id ? 'shrink-0 border-primary bg-primary/10' : 'shrink-0'}
                      onClick={() => setActiveFooterLinkIds((current) => ({ ...current, [section.id]: link.id }))}
                    >{link.labelEn?.trim() || `Link ${linkIndex + 1}`}</Button>)}
                  </div>
                  <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3 sm:p-4" role="tabpanel" aria-label={`Edit ${activeLink.labelEn || 'footer link'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">Edit footer link</strong>
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => {
                        const remaining = section.links.filter((item) => item.id !== activeLink.id)
                        updateSection(section.id, { links: remaining })
                        setActiveFooterLinkIds((current) => ({ ...current, [section.id]: remaining[0]?.id ?? '' }))
                      }} disabled={role === 'analyst' || saving} aria-label="Remove selected footer link"><Trash2 size={14} />Remove link</Button>
                    </div>
                    <label className="cms-field grid min-w-0 gap-1.5 text-sm font-medium">
                      <span>Label (English)</span>
                      <Input value={activeLink.labelEn} onChange={(event) => updateLink(section.id, activeLink.id, { labelEn: event.target.value })} disabled={role === 'analyst' || saving} maxLength={120} />
                    </label>
                    <label className="cms-field grid min-w-0 gap-1.5 text-sm font-medium">
                      <span>Label (বাংলা)</span>
                      <Input value={activeLink.labelBn} onChange={(event) => updateLink(section.id, activeLink.id, { labelBn: event.target.value })} disabled={role === 'analyst' || saving} maxLength={120} />
                    </label>
                    <label className="cms-field grid min-w-0 gap-1.5 text-sm font-medium">
                      <span>Site link · search or enter URL</span>
                      <Input list={`footer-site-links-${section.id}-${activeLink.id}`} value={activeLink.href} onChange={(event) => {
                        const selected = siteLinks.find((siteLink) => siteLink.href === event.target.value)
                        updateLink(section.id, activeLink.id, { href: event.target.value, ...(selected ? { labelEn: selected.label, labelBn: selected.labelBn || activeLink.labelBn } : {}) })
                      }} disabled={role === 'analyst' || saving} maxLength={500} placeholder="Search site pages or enter an external URL" />
                      <datalist id={`footer-site-links-${section.id}-${activeLink.id}`}>{siteLinks.map((siteLink) => <option key={siteLink.href} value={siteLink.href}>{siteLink.label}{siteLink.labelBn ? ` · ${siteLink.labelBn}` : ''}</option>)}</datalist>
                      <small className="admin-small-note">{siteLinks.length ? `${siteLinks.length} visible site links available. Type to search, or enter an external URL.` : 'Type a site path or external URL.'}</small>
                    </label>
                  </div>
                </div>
              })()}
            </div>}
          </section>)}
          {draft.sections.length === 0 && <div className="settings-footer-empty [min-height:110px] [display:grid] [justify-items:center] [align-content:center] [gap:5px] [padding:17px] [border:1px_dashed_var(--border)] [border-radius:var(--radius,_var(--radius))] [color:var(--muted-foreground)] [text-align:center] [&_svg]:[color:var(--primary)] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.75rem] [&_span]:[font-size:0.75rem]"><Link2 size={20} /><strong>No footer sections</strong><span>Add a navigation, custom-link or contact section.</span></div>}
          <Button type="button" variant="outline" onClick={addSection} disabled={role === 'analyst' || saving || draft.sections.length >= 8}><Plus size={15} />Add footer section</Button>
        </div>}
        {role === 'analyst' && <p className="admin-small-note">Analyst access is read-only. An administrator or editor can update footer settings.</p>}
      </CardContent>
    </Card>
    </div>
    </>}
        </div>
      </AdminDataContainer>
    </AdminWorkspaceGrid>
  )
}
