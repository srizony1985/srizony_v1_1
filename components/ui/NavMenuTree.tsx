'use client'

import AppLink from '@/components/ui/AppLink'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Lang, NavItem } from '@/types/entityType'
import type { CSSProperties } from 'react'
import { toCmsTypographyStyle } from '@/lib/cms/typography'

/** Dropdown list. Items with children open a fly-out to the side on hover / keyboard focus (no always-open trees). */
export default function NavMenuTree({ items, lang, isActive, onNavigate, depth = 0 }: { items: NavItem[]; lang: Lang; isActive: (href: string) => boolean; onNavigate: () => void; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <ul className={depth === 0 ? 'sf-menu' : 'sf-menu sf-menu--sub'} role={depth === 0 ? undefined : 'menu'}>
      {items.map((item) => {
        const hasSub = Boolean(item.children?.length)
        const key = `${item.href}-${item.label.en}`
        const isExpanded = Boolean(expanded[key])
        const containsActiveRoute = (node: NavItem): boolean =>
          (node.menuType !== 'folder' && isActive(node.href)) || Boolean(node.children?.some(containsActiveRoute))
        const isActivePath = containsActiveRoute(item)
        const isExactActive = item.menuType !== 'folder' && isActive(item.href)
        return (
          <li
            key={key}
            className={`${hasSub ? 'has-sub' : ''} ${isExpanded ? 'is-open' : ''} ${isActivePath ? 'is-active-path' : ''}`}
            onPointerEnter={(event) => {
              if (hasSub && (event.pointerType === 'mouse' || event.pointerType === 'pen')) {
                setExpanded((current) => ({ ...current, [key]: true }))
              }
            }}
            onPointerLeave={(event) => {
              if (hasSub && (event.pointerType === 'mouse' || event.pointerType === 'pen') && !event.currentTarget.contains(document.activeElement)) {
                setExpanded((current) => ({ ...current, [key]: false }))
              }
            }}
            onFocusCapture={(event) => {
              const target = event.target as HTMLElement
              // Focus events bubble through every ancestor <li>. Only the item
              // that owns the focused control may open its own flyout.
              if (hasSub && target.parentElement === event.currentTarget && target.matches('.sf-menu-link')) {
                setExpanded((current) => ({ ...current, [key]: true }))
              }
            }}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as Node | null
              if (hasSub && (!nextTarget || !event.currentTarget.contains(nextTarget))) {
                setExpanded((current) => ({ ...current, [key]: false }))
              }
            }}
          >
            {item.menuType === 'folder' ? (
              <button type="button" className={`sf-menu-link sf-menu-folder ${isActivePath ? 'is-active' : ''}`} style={toCmsTypographyStyle(item.typography) as CSSProperties} aria-haspopup={hasSub ? 'true' : undefined} aria-expanded={hasSub ? isExpanded : undefined} aria-current={isActivePath && !hasSub ? 'page' : undefined} onClick={(event) => {
                if (!hasSub) return
                const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
                const alreadyHovering = hoverPointer && event.currentTarget.matches(':hover')
                setExpanded((current) => ({ ...current, [key]: alreadyHovering ? true : !current[key] }))
              }}>
                <span>{item.label[lang]}</span>{hasSub && <ChevronRight size={15} aria-hidden="true" />}
              </button>
            ) : (
              <AppLink href={item.href} action={item.menuType === 'external' ? 'external' : undefined} className={`sf-menu-link ${isActivePath ? 'is-active' : ''}`} style={toCmsTypographyStyle(item.typography) as CSSProperties} aria-current={isExactActive ? 'page' : undefined} aria-haspopup={hasSub ? 'true' : undefined} onClick={onNavigate}>
                <span>{item.label[lang]}</span>{hasSub && <ChevronRight size={15} aria-hidden="true" />}
              </AppLink>
            )}
            {hasSub && <NavMenuTree items={item.children!} lang={lang} isActive={isActive} onNavigate={onNavigate} depth={depth + 1} />}
          </li>
        )
      })}
    </ul>
  )
}

