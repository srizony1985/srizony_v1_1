'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CirclePlus, Eye, EyeOff, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addMenu, getNavigation, modifyMenu, removeMenu, saveMenuOrder, setNavigationVisibility, type NavGroup, type NavNode, type MenuType, type SectionButtonType } from '@/lib/api/navigation'
import type { Section } from '@/types/entityType'
import { AdminErrorState, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'

// Home is the fixed root. All descendant menu levels remain editable.
const RENDERED_COMPONENTS: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']
type Zone = 'before' | 'after' | 'inside'
type Editor = { mode: 'create' | 'edit'; parentId: number | null; id?: number; labelEn: string; labelBn: string; slug: string; slugTouched: boolean; renderedComponents: Section['type'][]; menuType: MenuType; sectionCount: number; sectionContentType: Section['type']; sectionButtonType: SectionButtonType }

const slugify = (value: string) => '/' + value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
function find(nodes: NavNode[], id: number): NavNode | null { for (const node of nodes) { if (node.id === id) return node; const child = find(node.children, id); if (child) return child } return null }
function without(nodes: NavNode[], id: number): NavNode[] { return nodes.filter((node) => node.id !== id).map((node) => ({ ...node, children: without(node.children, id) })) }
function dropZone(_depth: number, ratio: number): Zone { return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside' }
function place(nodes: NavNode[], target: number, zone: Zone, moved: NavNode): NavNode[] {
  const next: NavNode[] = []
  for (const node of nodes) {
    if (node.id === target && zone === 'before') next.push(moved)
    if (node.id === target && zone === 'inside') next.push({ ...node, children: [...node.children, moved] })
    else next.push({ ...node, children: place(node.children, target, zone, moved) })
    if (node.id === target && zone === 'after') next.push(moved)
  }
  return next
}
const toMove = (nodes: NavNode[]): { id: number; children: { id: number; children: any[] }[] }[] => nodes.map((node) => ({ id: node.id, children: toMove(node.children) }))

function reorderSibling(nodes: NavNode[], id: number, delta: -1 | 1): { nodes: NavNode[]; changed: boolean } {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) {
    const target = index + delta
    if (nodes[index].isLandingPage || target < 0 || target >= nodes.length || nodes[target].isLandingPage) return { nodes, changed: false }
    const next = [...nodes]
    ;[next[index], next[target]] = [next[target], next[index]]
    return { nodes: next, changed: true }
  }
  for (let index = 0; index < nodes.length; index += 1) {
    const result = reorderSibling(nodes[index].children, id, delta)
    if (result.changed) {
      const next = [...nodes]
      next[index] = { ...nodes[index], children: result.nodes }
      return { nodes: next, changed: true }
    }
  }
  return { nodes, changed: false }
}

export default function NavigationPage() {
  const { data, setData, loading, error, reload } = useAdminFetch<NavGroup[]>(getNavigation)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [confirm, setConfirm] = useState<NavNode | null>(null)
  const [busy, setBusy] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<{ id: number; zone: Zone } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const editorBaselineRef = useRef('')

  const navigation = useMemo(() => data?.find((item) => item.key === 'primary') ?? data?.[0] ?? null, [data])
  const tree = navigation?.items ?? []

  async function move(targetId: number, requestedZone: Zone) {
    if (!navigation || !data || dragId === null || busy) return
    const dragged = find(tree, dragId)
    if (!dragged || dragged.isLandingPage || targetId === dragId || find(dragged.children, targetId)) return
    const rest = without(tree, dragId)
    const targetExists = find(rest, targetId)
    if (!targetExists) return
    const next = place(rest, targetId, requestedZone, dragged)
    const previous = data
    setBusy(true)
    setData(previous.map((item) => item.key === navigation.key ? { ...item, items: next } : item))
    try { await saveMenuOrder('primary', toMove(next)); toast.success('Navigation order saved.'); setOver(null) }
    catch (cause) { setData(previous); toast.error(cause instanceof Error ? cause.message : 'Unable to save the new order.') }
    finally { setBusy(false) }
  }

  async function reorderMenu(id: number, delta: -1 | 1) {
    if (!navigation || !data || busy) return
    const result = reorderSibling(tree, id, delta)
    if (!result.changed) return
    const previous = data
    setBusy(true)
    setData(previous.map((item) => item.key === navigation.key ? { ...item, items: result.nodes } : item))
    try { await saveMenuOrder('primary', toMove(result.nodes)); toast.success('Navigation order saved.') }
    catch (cause) { setData(previous); toast.error(cause instanceof Error ? cause.message : 'Unable to save the new order.') }
    finally { setBusy(false) }
  }

  function suggestedPath(parentId: number, label: string) {
    let parent = find(tree, parentId)
    while (parent && (parent.menuType === 'folder' || !parent.slug)) parent = parent.parentId ? find(tree, parent.parentId) : null
    const base = parent?.slug && parent.slug !== '/' ? parent.slug : ''
    return `${base}/${slugify(label).replace(/^\//, '')}`
  }
  function openCreate(parentId: number) {
    setEditorError('')
    const next: Editor = { mode: 'create', parentId, labelEn: '', labelBn: '', slug: '', slugTouched: false, renderedComponents: [...RENDERED_COMPONENTS], menuType: 'page', sectionCount: 1, sectionContentType: 'richText', sectionButtonType: 'none' }
    editorBaselineRef.current = JSON.stringify(next)
    setEditor(next)
  }
  function openEdit(node: NavNode) {
    setEditorError('')
    const next: Editor = { mode: 'edit', parentId: node.parentId ?? null, id: node.id, labelEn: node.labelEn, labelBn: node.labelBn, slug: node.slug, slugTouched: true, renderedComponents: node.renderedComponents?.length ? node.renderedComponents : [...RENDERED_COMPONENTS], menuType: node.menuType || 'page', sectionCount: node.sectionCount || 1, sectionContentType: node.sectionContentType || 'richText', sectionButtonType: node.sectionButtonType || 'none' }
    editorBaselineRef.current = JSON.stringify(next)
    setEditor(next)
  }

  async function toggleVisibility(node: NavNode) {
    setBusy(true)
    try { await setNavigationVisibility(node.id, node.visible === false); await reload(); toast.success(node.visible === false ? 'Menu is now visible.' : 'Menu hidden from navigation.') }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Unable to change menu visibility.') }
    finally { setBusy(false) }
  }

  async function submit() {
    if (!editor || !navigation) return
    if (!editor.labelEn.trim()) { const issue = 'Enter the menu name in English.'; setEditorError(issue); return toast.error(issue) }
    if (editor.menuType === 'page' && !editor.renderedComponents.length) { const issue = 'Select at least one rendered component for this page.'; setEditorError(issue); return toast.error(issue) }
    if (editor.menuType === 'external' && !/^https?:\/\//i.test(editor.slug.trim())) { const issue = 'External menu URLs must begin with http:// or https://.'; setEditorError(issue); return toast.error(issue) }
    if (editor.menuType === 'page' && !editor.slug.trim()) { const issue = 'Enter the complete public page slug.'; setEditorError(issue); return toast.error(issue) }
    const input = { labelEn: editor.labelEn.trim(), labelBn: editor.labelBn.trim(), slug: editor.menuType === 'folder' ? '' : editor.slug.trim(), renderedComponents: editor.menuType === 'page' ? editor.renderedComponents : [], menuType: editor.menuType, sectionCount: editor.sectionCount, sectionContentType: editor.sectionContentType, sectionButtonType: editor.sectionButtonType }
    setEditorError('')
    setBusy(true)
    try {
      if (editor.mode === 'create') { await addMenu('primary', editor.parentId!, input); toast.success(editor.menuType === 'folder' ? 'Navigation folder added.' : 'Menu added and its page created.') }
      else { await modifyMenu(editor.id!, input); toast.success('Navigation item updated.') }
      setEditor(null); await reload()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save the menu.'
      setEditorError(message)
      toast.error(message, { description: 'Your form values are still here. Correct the issue and retry.' })
    } finally { setBusy(false) }
  }

  async function doRemove() {
    if (!confirm) return
    setBusy(true)
    try { const result = await removeMenu(confirm.id); toast.success(`Removed ${result.menus} navigation item(s) and ${result.pages} page(s).`); setConfirm(null); await reload() }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Unable to remove the menu.') }
    finally { setBusy(false) }
  }

  const editorDirty = Boolean(editor) && editorBaselineRef.current !== JSON.stringify(editor)
  useRegisterAdminActions('navigation-editor', { save: async () => { await submit() }, reload: async () => { setEditor(null); setEditorError(''); await reload() }, dirty: editorDirty, saving: busy && Boolean(editor), label: 'Navigation editor' })

  const count = (node: NavNode): number => 1 + node.children.reduce((total, child) => total + count(child), 0)

  function Row({ node, depth, siblings, siblingIndex }: { node: NavNode; depth: number; siblings: NavNode[]; siblingIndex: number }) {
    const isOpen = !collapsed.has(node.id)
    const hot = over?.id === node.id ? over.zone : null
    return <div className="nav-node">
      <div
        className={`nav-row ${dragId === node.id ? 'dragging' : ''} ${hot ? `drop-${hot}` : ''}`}
        draggable={!node.isLandingPage && !busy}
        onDragStart={(event) => { if (node.isLandingPage) { event.preventDefault(); return } setDragId(node.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(node.id)) }}
        onDragEnd={() => { setDragId(null); setOver(null) }}
        onDragOver={(event) => {
          if (node.isLandingPage || dragId === null || dragId === node.id || busy) return
          event.preventDefault(); event.stopPropagation()
          const box = event.currentTarget.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (event.clientY - box.top) / Math.max(1, box.height)))
          setOver({ id: node.id, zone: dropZone(depth, ratio) })
        }}
        onDrop={(event) => {
          event.preventDefault(); event.stopPropagation()
          if (node.isLandingPage || busy) { setOver(null); setDragId(null); return }
          const box = event.currentTarget.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (event.clientY - box.top) / Math.max(1, box.height)))
          const zone = dropZone(depth, ratio)
          setOver(null); void move(node.id, zone); setDragId(null)
        }}
      >
        <span className="nav-grip" aria-hidden><GripVertical size={16} /></span>
        <button type="button" className="nav-toggle" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next })} aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.labelEn} submenus`}>
          {node.children.length ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
        </button>
        <div className="nav-label"><strong>{node.isLandingPage ? 'Home — Landing Page' : node.labelEn}</strong><small><span>{node.labelBn || '—'}</span><code>{node.menuType === 'folder' ? 'Navigation folder · no public URL' : node.slug}</code></small></div>
        <div className="nav-chips"><span className="nav-chip">{node.isLandingPage ? 'Fixed landing page' : node.menuType === 'folder' ? 'Navigation folder' : node.menuType === 'external' ? 'External link' : 'Internal page'}</span><span className="nav-chip">Level {depth}</span>{node.visible === false && <span className="nav-chip">Hidden</span>}</div>
        <div className="nav-actions">
          {node.isLandingPage ? <span className="nav-chip" title="Home is fixed. Edit its page content from the Landing Page section in the CMS sidebar.">Fixed · edit content in Landing Page</span> : <>
            <Button variant="outline" size="sm" onClick={() => void toggleVisibility(node)} disabled={busy} title={node.visible === false ? 'Show in navigation' : 'Hide from navigation'} aria-label={node.visible === false ? `Show ${node.labelEn} in navigation` : `Hide ${node.labelEn} from navigation`}>{node.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}</Button>
            <Button variant="outline" size="sm" onClick={() => void reorderMenu(node.id, -1)} disabled={busy || siblingIndex === 0} title="Move menu up" aria-label={`Move ${node.labelEn} up`}><ArrowUp size={14} /></Button>
            <Button variant="outline" size="sm" onClick={() => void reorderMenu(node.id, 1)} disabled={busy || siblingIndex === siblings.length - 1} title="Move menu down" aria-label={`Move ${node.labelEn} down`}><ArrowDown size={14} /></Button>
            <Button variant="outline" size="sm" onClick={() => openCreate(node.id)} title="Add submenu" aria-label={`Add submenu to ${node.labelEn}`}><CirclePlus size={14} /></Button>
            <Button variant="outline" size="sm" onClick={() => openEdit(node)} title="Modify" aria-label={`Modify ${node.labelEn}`}><Pencil size={14} /></Button>
            <Button variant="outline" size="sm" onClick={() => setConfirm(node)} title="Remove" aria-label={`Remove ${node.labelEn}`}><Trash2 size={14} /></Button>
          </>}
        </div>
      </div>
      {isOpen && node.children.length > 0 && <div className="nav-children">{node.children.map((child, index, list) => <Row key={child.id} node={child} depth={depth + 1} siblings={list} siblingIndex={index} />)}</div>}
    </div>
  }

  return <>
    <SectionToolbar
      title="Site Navigation"
      description="One editable navigation tree. Home is fixed and cannot be edited or reordered. All other items—including Who We Are, What We Do, folders, pages and submenus—can be edited and rearranged. Public page slugs never change when you reorder a menu."
      count={tree.reduce((total, node) => total + count(node), 0)}
      onRefresh={() => void reload()}
      refreshing={loading}
      actions={<Button onClick={() => navigation && openCreate(navigation.landingId)} disabled={!navigation || busy}><CirclePlus size={15} /> Add top-level menu</Button>}
    />
    {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : <Card>
      <CardHeader>
        <CardTitle>Single navigation tree</CardTitle>
        <CardDescription>Home → Who We Are / What We Do / Projects / Career / Notice / Contact. Changes to order and nesting save immediately.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="nav-tree">
          {tree.map((node, index, siblings) => <Row key={node.id} node={node} depth={1} siblings={siblings} siblingIndex={index} />)}
          {!tree.length && <div className="admin-empty-state">No navigation items found. Run database migration 0016 to install the requested menu structure.</div>}
        </div>
      </CardContent>
    </Card>}

    {editor && <div className="cms-modal" role="dialog" aria-modal="true" aria-label={editor.mode === 'create' ? 'Add navigation item' : 'Edit navigation item'}>
      <div className="cms-modal-card">
        <h2>{editor.mode === 'create' ? 'Add navigation item' : 'Edit navigation item'}</h2>
        <p className="admin-small-note">Create a page with a public slug, a folder that only organizes dropdowns, or an external link.</p>
        <div className="cms-form-grid">
          <div><Label htmlFor="m-en">Menu title (English)</Label><Input id="m-en" value={editor.labelEn} onChange={(event) => setEditor({ ...editor, labelEn: event.target.value, slug: editor.slugTouched || editor.menuType !== 'page' ? editor.slug : suggestedPath(editor.parentId ?? navigation?.landingId ?? 0, event.target.value) })} /></div>
          <div><Label htmlFor="m-bn">Menu title (বাংলা)</Label><Input id="m-bn" value={editor.labelBn} onChange={(event) => setEditor({ ...editor, labelBn: event.target.value })} /></div>
          <div><Label htmlFor="m-type">Navigation item type</Label><select id="m-type" className="ui-select" value={editor.menuType} onChange={(event) => { const menuType = event.target.value as MenuType; setEditor({ ...editor, menuType, slug: menuType === 'page' ? (editor.slug.startsWith('/') ? editor.slug : suggestedPath(editor.parentId ?? navigation?.landingId ?? 0, editor.labelEn)) : '', slugTouched: menuType !== 'page' }) }}><option value="page">Page (has a slug)</option><option value="folder">Folder (no URL)</option><option value="external">External URL</option></select></div>
          {editor.menuType !== 'folder' && <div><Label htmlFor="m-slug">{editor.menuType === 'external' ? 'External URL' : 'Page route / slug'}</Label><Input id="m-slug" value={editor.slug} onChange={(event) => setEditor({ ...editor, slug: event.target.value, slugTouched: true })} placeholder={editor.menuType === 'external' ? 'https://example.org' : '/about-us/partners-networks'} /><small className="admin-small-note">Enter the complete public route. Reordering never changes it.</small></div>}
          {editor.menuType === 'folder' && <p className="admin-small-note">Folders have no URL. They are used only as expandable navigation headings.</p>}
        </div>
        {editorError && <div className="cms-save-error" role="alert"><strong>Menu changes were not saved.</strong><span>{editorError}</span><small>Your entries are still in this form. Correct the issue and retry.</small></div>}
        <div className="cms-modal-actions"><Button variant="outline" onClick={() => { if (editorDirty && !window.confirm('Discard the unsaved navigation changes?')) return; setEditor(null); setEditorError('') }} disabled={busy}>Cancel</Button><Button onClick={() => void submit()} disabled={busy}>{busy ? 'Saving…' : editor.mode === 'create' ? 'Add navigation item' : 'Save changes'}</Button></div>
      </div>
    </div>}

    {confirm && <div className="cms-modal" role="alertdialog" aria-modal="true">
      <div className="cms-modal-card">
        <h2>Remove “{confirm.labelEn}”?</h2>
        <p>This removes the navigation item{count(confirm) > 1 ? ` and its ${count(confirm) - 1} child item(s)` : ''}. Public content pages are preserved unless they were created solely by this menu.</p>
        <div className="cms-modal-actions"><Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button><Button className="cms-danger" onClick={() => void doRemove()} disabled={busy}>{busy ? 'Removing…' : 'Remove item'}</Button></div>
      </div>
    </div>}
  </>
}
