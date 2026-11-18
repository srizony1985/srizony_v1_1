'use client'

import { NativeSelect } from '@/components/ui/native-select'
import type { NavigationMoveNode } from '@/types/navigation'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addMenu,
  getNavigation,
  modifyMenu,
  removeMenu,
  saveMenuOrder,
  setNavigationVisibility,
  type NavGroup,
  type NavNode,
  type MenuType,
  type SectionButtonType,
} from '@/lib/api/navigation'
import type { CmsTypography, Section } from '@/types/entityType'
import CmsTypographyEditor from '@/components/admin/CmsTypographyEditor'
import {
  AdminErrorState,
  PageLoading,
  SectionToolbar,
  useAdminFetch,
} from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'
import { AdminDataContainer } from '@/components/admin/cms'

// Home is the fixed root. All descendant menu levels remain editable.
const RENDERED_COMPONENTS: Section['type'][] = [
  'richText',
  'stats',
  'cards',
  'gallery',
  'timeline',
  'diagram',
  'table',
  'video',
  'cta',
  'noticeList',
  'contact',
  'donation',
  'carousel',
  'contentFeed',
  'reports',
]

type Zone = 'before' | 'after' | 'inside'
type Editor = {
  mode: 'create' | 'edit'
  parentId: number | null
  id?: number
  labelEn: string
  labelBn: string
  slug: string
  slugTouched: boolean
  renderedComponents: Section['type'][]
  menuType: MenuType
  sectionCount: number
  sectionContentType: Section['type']
  sectionButtonType: SectionButtonType
  typography?: CmsTypography
}

const slugify = (value: string) =>
  '/' + value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

function find(nodes: NavNode[], id: number): NavNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = find(node.children, id)
    if (child) return child
  }
  return null
}

const toMove = (nodes: NavNode[]): NavigationMoveNode[] =>
  nodes.map((node) => ({ id: node.id, children: toMove(node.children) }))

function reorderSibling(
  nodes: NavNode[],
  id: number,
  delta: -1 | 1,
): { nodes: NavNode[]; changed: boolean } {
  const index = nodes.findIndex((node) => node.id === id)

  if (index >= 0) {
    const target = index + delta
    if (
      nodes[index].isLandingPage ||
      target < 0 ||
      target >= nodes.length ||
      nodes[target].isLandingPage
    ) {
      return { nodes, changed: false }
    }

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

function normalizeNavigationSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Filters a navigation tree without losing hierarchy.
 * Matching descendants retain their ancestors. If a node itself matches,
 * its complete subtree remains visible.
 */
function filterNavigationTree(nodes: NavNode[], query: string): NavNode[] {
  const normalizedQuery = normalizeNavigationSearch(query)
  if (!normalizedQuery) return nodes

  const terms = normalizedQuery.split(' ')

  return nodes.reduce<NavNode[]>((results, node) => {
    const componentTerms = (node.renderedComponents ?? []).flatMap((component) => [
      component,
      component.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    ])

    const menuTypeTerms =
      node.menuType === 'page'
        ? ['page', 'internal', 'internal page']
        : node.menuType === 'folder'
          ? ['folder', 'group', 'directory']
          : ['external', 'external link', 'url']

    const visibilityTerms = node.visible === false
      ? ['hidden', 'invisible', 'disabled']
      : ['visible', 'shown', 'published']

    const searchableText = normalizeNavigationSearch([
      node.labelEn,
      node.labelBn,
      node.slug,
      node.menuType,
      ...menuTypeTerms,
      ...visibilityTerms,
      ...componentTerms,
      node.isLandingPage ? 'home landing page homepage' : '',
      node.sectionCount != null ? String(node.sectionCount) : '',
      node.sectionContentType ?? '',
      node.sectionButtonType ?? '',
    ].join(' '))

    const matches = terms.every((term) => searchableText.includes(term))
    const filteredChildren = matches
      ? node.children
      : filterNavigationTree(node.children, normalizedQuery)

    if (matches || filteredChildren.length > 0) {
      results.push({ ...node, children: filteredChildren })
    }

    return results
  }, [])
}

function countNavigationNodes(nodes: NavNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countNavigationNodes(node.children),
    0,
  )
}

export default function NavigationPage() {
  const { data, setData, loading, error, reload } = useAdminFetch<NavGroup[]>(getNavigation)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [confirm, setConfirm] = useState<NavNode | null>(null)
  const [busy, setBusy] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const editorBaselineRef = useRef('')

  const navigation = useMemo(
    () => data?.find((item) => item.key === 'primary') ?? data?.[0] ?? null,
    [data],
  )
  const tree = navigation?.items ?? []
  const searchActive = Boolean(deferredSearchQuery.trim())

  const filteredTree = useMemo(
    () => filterNavigationTree(tree, deferredSearchQuery),
    [tree, deferredSearchQuery],
  )
  const totalNavigationCount = useMemo(() => countNavigationNodes(tree), [tree])
  const filteredNavigationCount = useMemo(
    () => countNavigationNodes(filteredTree),
    [filteredTree],
  )

  function reorderMenu(id: number, delta: -1 | 1) {
    if (!navigation || !data || busy || searchActive) return Promise.resolve()

    const result = reorderSibling(tree, id, delta)
    if (!result.changed) return Promise.resolve()

    const previous = data
    setBusy(true)
    setData(previous.map((item) =>
      item.key === navigation.key ? { ...item, items: result.nodes } : item,
    ))

    return saveMenuOrder('primary', toMove(result.nodes))
      .then(() => toast.success('Navigation order saved.'))
      .catch((cause: unknown) => {
        setData(previous)
        toast.error(cause instanceof Error ? cause.message : 'Unable to save the new order.')
      })
      .finally(() => setBusy(false))
  }

  function suggestedPath(parentId: number, label: string) {
    let parent = find(tree, parentId)
    while (parent && (parent.menuType === 'folder' || !parent.slug)) {
      parent = parent.parentId ? find(tree, parent.parentId) : null
    }
    const base = parent?.slug && parent.slug !== '/' ? parent.slug : ''
    return `${base}/${slugify(label).replace(/^\//, '')}`
  }

  function openCreate(parentId: number) {
    setEditorError('')
    const next: Editor = {
      mode: 'create',
      parentId,
      labelEn: '',
      labelBn: '',
      slug: '',
      slugTouched: false,
      renderedComponents: [...RENDERED_COMPONENTS],
      menuType: 'page',
      sectionCount: 1,
      sectionContentType: 'richText',
      sectionButtonType: 'none',
      typography: undefined,
    }
    editorBaselineRef.current = JSON.stringify(next)
    setEditor(next)
  }

  function openEdit(node: NavNode) {
    setEditorError('')
    const next: Editor = {
      mode: 'edit',
      parentId: node.parentId ?? null,
      id: node.id,
      labelEn: node.labelEn,
      labelBn: node.labelBn,
      slug: node.slug,
      slugTouched: true,
      renderedComponents: node.renderedComponents?.length
        ? node.renderedComponents
        : [...RENDERED_COMPONENTS],
      menuType: node.menuType || 'page',
      sectionCount: node.sectionCount || 1,
      sectionContentType: node.sectionContentType || 'richText',
      sectionButtonType: node.sectionButtonType || 'none',
      typography: node.typography,
    }
    editorBaselineRef.current = JSON.stringify(next)
    setEditor(next)
  }

  function toggleVisibility(node: NavNode) {
    setBusy(true)
    return setNavigationVisibility(node.id, node.visible === false)
      .then(() => reload())
      .then(() => toast.success(
        node.visible === false ? 'Menu is now visible.' : 'Menu hidden from navigation.',
      ))
      .catch((cause: unknown) => toast.error(
        cause instanceof Error ? cause.message : 'Unable to change menu visibility.',
      ))
      .finally(() => setBusy(false))
  }

  function submit() {
    if (!editor || !navigation) return Promise.resolve()

    if (!editor.labelEn.trim()) {
      const issue = 'Enter the menu name in English.'
      setEditorError(issue)
      toast.error(issue)
      return Promise.resolve()
    }

    if (editor.menuType === 'page' && !editor.renderedComponents.length) {
      const issue = 'Select at least one rendered component for this page.'
      setEditorError(issue)
      toast.error(issue)
      return Promise.resolve()
    }

    if (editor.menuType === 'external' && !/^https?:\/\//i.test(editor.slug.trim())) {
      const issue = 'External menu URLs must begin with http:// or https://.'
      setEditorError(issue)
      toast.error(issue)
      return Promise.resolve()
    }

    if (editor.menuType === 'page' && !editor.slug.trim()) {
      const issue = 'Enter the complete public page slug.'
      setEditorError(issue)
      toast.error(issue)
      return Promise.resolve()
    }

    const input = {
      labelEn: editor.labelEn.trim(),
      labelBn: editor.labelBn.trim(),
      slug: editor.menuType === 'folder' ? '' : editor.slug.trim(),
      renderedComponents: editor.menuType === 'page' ? editor.renderedComponents : [],
      menuType: editor.menuType,
      sectionCount: editor.sectionCount,
      sectionContentType: editor.sectionContentType,
      sectionButtonType: editor.sectionButtonType,
      typography: editor.typography,
    }

    setEditorError('')
    setBusy(true)

    const saveRequest = editor.mode === 'create'
      ? addMenu('primary', editor.parentId!, input).then(() => toast.success(
          editor.menuType === 'folder'
            ? 'Navigation folder added.'
            : 'Menu added and its page created.',
        ))
      : modifyMenu(editor.id!, input).then(() => toast.success('Navigation item updated.'))

    return saveRequest
      .then(() => {
        setEditor(null)
        return reload()
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save the menu.'
        setEditorError(message)
        toast.error(message, {
          description: 'Your form values are still here. Correct the issue and retry.',
        })
      })
      .finally(() => setBusy(false))
  }

  function doRemove() {
    if (!confirm) return Promise.resolve()

    setBusy(true)
    return removeMenu(confirm.id)
      .then((result) => {
        toast.success(`Removed ${result.menus} navigation item(s) and ${result.pages} page(s).`)
        setConfirm(null)
        return reload()
      })
      .catch((cause: unknown) => toast.error(
        cause instanceof Error ? cause.message : 'Unable to remove the menu.',
      ))
      .finally(() => setBusy(false))
  }

  const editorDirty = Boolean(editor) && editorBaselineRef.current !== JSON.stringify(editor)

  useRegisterAdminActions('navigation-editor', {
    save: submit,
    reload: () => {
      setEditor(null)
      setEditorError('')
      return reload()
    },
    dirty: editorDirty,
    saving: busy && Boolean(editor),
    label: 'Navigation editor',
  })

  const count = (node: NavNode): number =>
    1 + node.children.reduce((total, child) => total + count(child), 0)

  function Row({
    node,
    depth,
    siblings,
    siblingIndex,
  }: {
    node: NavNode
    depth: number
    siblings: NavNode[]
    siblingIndex: number
  }) {
    // During search, expand every retained branch so descendant matches are visible.
    const isOpen = searchActive || !collapsed.has(node.id)

    return (
      <div
        className="flex w-full min-w-0 flex-col gap-2"
        role="treeitem"
        aria-level={depth}
        aria-selected={false}
        aria-expanded={node.children.length > 0 ? isOpen : undefined}
      >
        <div
          className={[
            'flex w-full min-w-0 flex-col gap-3 rounded-lg border p-3 transition-colors',
            'sm:flex-row sm:items-center sm:justify-between',
            'border-border bg-card text-card-foreground',
          ].join(' ')}
        >
          {node.children.length > 0 ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setCollapsed((current) => {
                const next = new Set(current)
                if (next.has(node.id)) next.delete(node.id)
                else next.add(node.id)
                return next
              })}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.labelEn} submenus`}
              title={isOpen ? 'Collapse submenus' : 'Expand submenus'}
              disabled={searchActive}
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          ) : (
            <span className="size-8" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <strong className="truncate text-sm font-semibold text-primary">
                {node.isLandingPage ? 'Home' : node.labelEn}
              </strong>

              <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Level {depth}
              </span>

              {node.visible === false && (
                <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Hidden
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <span>{node.labelBn || '—'}</span>
              <code className="break-all rounded bg-muted px-1.5 py-0.5">
                {node.menuType === 'folder'
                  ? 'Navigation folder · no public URL'
                  : node.slug}
              </code>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {node.isLandingPage
                  ? 'Fixed landing page'
                  : node.menuType === 'folder'
                    ? 'Navigation folder'
                    : node.menuType === 'external'
                      ? 'External link'
                      : 'Internal page'}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
            {node.isLandingPage ? (
              <span
                className="max-w-56 text-xs text-muted-foreground"
                title="Home is fixed. Edit its page content from the Landing Page section in the CMS sidebar."
              >
                Fixed · edit content in Landing Page
              </span>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => void toggleVisibility(node)}
                  disabled={busy}
                  title={node.visible === false ? 'Show in navigation' : 'Hide from navigation'}
                  aria-label={node.visible === false
                    ? `Show ${node.labelEn} in navigation`
                    : `Hide ${node.labelEn} from navigation`}
                >
                  {node.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => void reorderMenu(node.id, -1)}
                  disabled={busy || searchActive || siblingIndex === 0}
                  title={searchActive ? 'Clear search to reorder navigation' : 'Move menu up'}
                  aria-label={`Move ${node.labelEn} up`}
                >
                  <ArrowUp size={14} />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => void reorderMenu(node.id, 1)}
                  disabled={busy || searchActive || siblingIndex === siblings.length - 1}
                  title={searchActive ? 'Clear search to reorder navigation' : 'Move menu down'}
                  aria-label={`Move ${node.labelEn} down`}
                >
                  <ArrowDown size={14} />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => openCreate(node.id)}
                  disabled={busy}
                  title="Add submenu"
                  aria-label={`Add submenu to ${node.labelEn}`}
                >
                  <CirclePlus size={14} />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => openEdit(node)}
                  disabled={busy}
                  title="Modify"
                  aria-label={`Modify ${node.labelEn}`}
                >
                  <Pencil size={14} />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirm(node)}
                  disabled={busy}
                  title="Remove"
                  aria-label={`Remove ${node.labelEn}`}
                >
                  <Trash2 size={14} />
                </Button>
              </>
            )}
          </div>
        </div>

        {isOpen && node.children.length > 0 && (
          <div
            role="group"
            className="ml-4 flex min-w-0 flex-col gap-2 border-l-2 border-border pl-4 sm:ml-6 sm:pl-5"
          >
            {node.children.map((child, index, list) => (
              <Row
                key={child.id}
                node={child}
                depth={depth + 1}
                siblings={list}
                siblingIndex={index}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="admin-page-stack">
      <SectionToolbar
        title="Site Navigation"
        search={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder="Search menus, Bengali titles, slugs, or components…"
        onRefresh={() => void reload()}
        refreshing={loading}
        actions={(
          <Button
            onClick={() => navigation && openCreate(navigation.landingId)}
            disabled={!navigation || busy}
          >
            <CirclePlus size={15} /> Add menu
          </Button>
        )}
      />

      {loading && !data ? (
        <PageLoading rows={3} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <AdminDataContainer
          label="site navigation tree"
          title="Single navigation tree"
          description="Home is fixed and cannot be edited or reordered. All other items—including Who We Are, What We Do, folders, pages and submenus—can be edited and rearranged. Public page slugs never change when you reorder a menu."
          status={editor
            ? { content: editor.mode === 'create' ? 'Ready to create new menu item' : 'Editing menu item...' }
            : { content: 'Configuration loaded' }}
          instructions="Creating a new menu item also creates a new page with the selected rendered components. You can edit the page content from the Pages section in the CMS sidebar."
          className="site-config-workspace"
          bodyClassName="site-config-workspace__body"
          bodyScroll="auto"
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                {searchActive
                  ? `Showing ${filteredNavigationCount} of ${totalNavigationCount} navigation items (matching branches and their parent paths)`
                  : `${totalNavigationCount} navigation items`}
              </span>
              {searchActive && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        >
          <div className="cms-navigation-tree grid min-w-0 gap-2" role="tree" aria-label="Site navigation">
            {filteredTree.map((node, index, siblings) => (
              <Row
                key={node.id}
                node={node}
                depth={1}
                siblings={siblings}
                siblingIndex={index}
              />
            ))}

            {!filteredTree.length && (
              <div className="admin-empty-state grid min-h-27.5 place-items-center rounded-(--radius,var(--radius)) border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
                {searchActive
                  ? `No navigation items match "${searchQuery.trim()}".`
                  : 'No navigation items found. Run database migration 0016 to install the requested menu structure.'}
              </div>
            )}
          </div>
        </AdminDataContainer>
      )}

      {editor && (
        <div
          className="cms-modal backdrop-blur-lg [position:fixed] [inset:0] [z-index:160] [isolation:isolate] [display:grid] [place-items:center] [background:var(--overlay)] [padding:16px] [z-index:var(--sf-z-modal)]"
          role="dialog"
          aria-modal="true"
          aria-label={editor.mode === 'create' ? 'Add navigation item' : 'Edit navigation item'}
        >
          <div className="cms-modal-card [position:relative] [z-index:1] [width:min(560px,_100%)] [max-height:90vh] [overflow:auto] [background:var(--surface,_var(--card))] [color:var(--text-primary,_var(--foreground))] [border-radius:var(--radius,_var(--radius))] [padding:22px] [box-shadow:var(--shadow-lg,_var(--shadow-md))] [&_h2]:[margin:0_0_6px]">
            <h2>{editor.mode === 'create' ? 'Add navigation item' : 'Edit navigation item'}</h2>
            <p className="admin-small-note">
              Create a page with a public slug, a folder that only organizes dropdowns, or an external link.
            </p>

            <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]">
              <div>
                <Label htmlFor="m-en">Menu title (English)</Label>
                <Input
                  id="m-en"
                  value={editor.labelEn}
                  onChange={(event) => setEditor({
                    ...editor,
                    labelEn: event.target.value,
                    slug: editor.slugTouched || editor.menuType !== 'page'
                      ? editor.slug
                      : suggestedPath(
                          editor.parentId ?? navigation?.landingId ?? 0,
                          event.target.value,
                        ),
                  })}
                />
              </div>

              <div>
                <Label htmlFor="m-bn">Menu title (বাংলা)</Label>
                <Input
                  id="m-bn"
                  value={editor.labelBn}
                  onChange={(event) => setEditor({ ...editor, labelBn: event.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="m-type">Navigation item type</Label>
                <NativeSelect
                  id="m-type"
                  value={editor.menuType}
                  onChange={(event) => {
                    const menuType = event.target.value as MenuType
                    setEditor({
                      ...editor,
                      menuType,
                      slug: menuType === 'page'
                        ? (editor.slug.startsWith('/')
                            ? editor.slug
                            : suggestedPath(
                                editor.parentId ?? navigation?.landingId ?? 0,
                                editor.labelEn,
                              ))
                        : '',
                      slugTouched: menuType !== 'page',
                    })
                  }}
                >
                  <option value="page">Page (has a slug)</option>
                  <option value="folder">Folder (no URL)</option>
                  <option value="external">External URL</option>
                </NativeSelect>
              </div>

              {editor.menuType !== 'folder' && (
                <div>
                  <Label htmlFor="m-slug">
                    {editor.menuType === 'external' ? 'External URL' : 'Page route / slug'}
                  </Label>
                  <Input
                    id="m-slug"
                    value={editor.slug}
                    onChange={(event) => setEditor({
                      ...editor,
                      slug: event.target.value,
                      slugTouched: true,
                    })}
                    placeholder={editor.menuType === 'external'
                      ? 'https://example.org'
                      : '/about-us/partners-networks'}
                  />
                  <small className="admin-small-note">
                    Enter the complete public route. Reordering never changes it.
                  </small>
                </div>
              )}

              {editor.menuType === 'folder' && (
                <p className="admin-small-note">
                  Folders have no URL. They are used only as expandable navigation headings.
                </p>
              )}
            </div>

            <CmsTypographyEditor
              value={editor.typography}
              onChange={(typography) => setEditor({ ...editor, typography })}
              title="Navigation typography"
            />

            {editorError && (
              <div
                className="cms-save-error [display:grid] [gap:4px] [margin-top:14px] [padding:12px_14px] [border:1px_solid_color-mix(in_srgb,var(--destructive)_28%,var(--border))] [border-left:4px_solid_var(--destructive)] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--destructive)_6%,var(--card))] [color:var(--foreground)] [&_strong]:[font-size:0.875rem] [&_span]:[font-size:0.875rem] [&_span]:[overflow-wrap:anywhere] [&_small]:[font-size:0.75rem] [&_small]:[color:var(--muted-foreground)]"
                role="alert"
              >
                <strong>Menu changes were not saved.</strong>
                <span>{editorError}</span>
                <small>Your entries are still in this form. Correct the issue and retry.</small>
              </div>
            )}

            <div className="cms-modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [margin-top:18px]">
              <Button
                variant="outline"
                onClick={() => {
                  if (editorDirty && !window.confirm('Discard the unsaved navigation changes?')) return
                  setEditor(null)
                  setEditorError('')
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={() => void submit()} disabled={busy}>
                {busy ? 'Saving…' : editor.mode === 'create' ? 'Add navigation item' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div
          className="cms-modal [position:fixed] [inset:0] [z-index:160] [isolation:isolate] [display:grid] [place-items:center] [background:var(--overlay)] [padding:16px] [z-index:var(--sf-z-modal)]"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="cms-modal-card [position:relative] [z-index:1] [width:min(560px,_100%)] [max-height:90vh] [overflow:auto] [background:var(--surface,_var(--card))] [color:var(--text-primary,_var(--foreground))] [border-radius:var(--radius,_var(--radius))] [padding:22px] [box-shadow:var(--shadow-lg,_var(--shadow-md))] [&_h2]:[margin:0_0_6px]">
            <h2>Remove “{confirm.labelEn}”?</h2>
            <p>
              This removes the navigation item
              {count(confirm) > 1 ? ` and its ${count(confirm) - 1} child item(s)` : ''}.
              Public content pages are preserved unless they were created solely by this menu.
            </p>
            <div className="cms-modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [margin-top:18px]">
              <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                className="cms-danger ![background:var(--destructive)] ![color:var(--primary-foreground)] ![border-color:var(--destructive)]"
                onClick={() => void doRemove()}
                disabled={busy}
              >
                {busy ? 'Removing…' : 'Remove item'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
