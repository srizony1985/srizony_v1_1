'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Lang, NavItem } from '@/types/entityType'

/** Dropdown list. Items with children open a fly-out to the side on hover / keyboard focus (no always-open trees). */
export default function NavMenuTree({ items, lang, isActive, onNavigate, depth = 0 }: { items: NavItem[]; lang: Lang; isActive: (href: string) => boolean; onNavigate: () => void; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <ul className={depth === 0 ? 'sf-menu' : 'sf-menu sf-menu--sub'} role={depth === 0 ? undefined : 'menu'}>
      {items.map((item) => {
        const hasSub = Boolean(item.children?.length)
        const key = `${item.href}-${item.label.en}`
        const isExpanded = Boolean(expanded[key])
        return (
          <li
            key={key}
            className={`${hasSub ? 'has-sub' : ''} ${isExpanded ? 'is-open' : ''}`}
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
            onFocusCapture={() => hasSub && setExpanded((current) => ({ ...current, [key]: true }))}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as Node | null
              if (hasSub && (!nextTarget || !event.currentTarget.contains(nextTarget))) {
                setExpanded((current) => ({ ...current, [key]: false }))
              }
            }}
          >
            {item.menuType === 'folder' ? (
              <button type="button" className="sf-menu-link sf-menu-folder" aria-haspopup={hasSub ? 'true' : undefined} aria-expanded={hasSub ? isExpanded : undefined} onClick={() => hasSub && setExpanded((current) => ({ ...current, [key]: !current[key] }))}>
                <span>{item.label[lang]}</span>{hasSub && <ChevronRight size={15} aria-hidden="true" />}
              </button>
            ) : item.menuType === 'external' ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer" className={`sf-menu-link ${isActive(item.href) ? 'is-active' : ''}`} aria-haspopup={hasSub ? 'true' : undefined} onClick={onNavigate}>
                <span>{item.label[lang]}</span>{hasSub && <ChevronRight size={15} aria-hidden="true" />}
              </a>
            ) : (
              <Link href={item.href} className={`sf-menu-link ${isActive(item.href) ? 'is-active' : ''}`} aria-current={isActive(item.href) ? 'page' : undefined} aria-haspopup={hasSub ? 'true' : undefined} onClick={onNavigate}>
                <span>{item.label[lang]}</span>{hasSub && <ChevronRight size={15} aria-hidden="true" />}
              </Link>
            )}
            {hasSub && <NavMenuTree items={item.children!} lang={lang} isActive={isActive} onNavigate={onNavigate} depth={depth + 1} />}
          </li>
        )
      })}
    </ul>
  )
}

