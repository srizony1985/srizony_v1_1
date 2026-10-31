import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

type BreadcrumbItem = {
  label: string
  href?: string
  current?: boolean
}

type Props = {
  items: BreadcrumbItem[]
  homeLabel: string
  homeHref?: string
  ariaLabel: string
}

/** Theme-token breadcrumb for standalone public pages outside the CMS PageTemplate. */
export default function PublicBreadcrumb({ items, homeLabel, homeHref = '/', ariaLabel }: Props) {
  const trail: BreadcrumbItem[] = [
    { label: homeLabel, href: homeHref },
    ...items,
  ]

  return (
    <nav className="sf-essentials-breadcrumb" aria-label={ariaLabel}>
      <ol>
        {trail.map((item, index) => {
          const current = item.current || (!item.href && index === trail.length - 1)
          return (
            <li key={`${item.label}-${index}`} aria-current={current ? 'page' : undefined}>
              {index === 0 && <Home size={14} aria-hidden="true" />}
              {item.href && !current ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
              {index < trail.length - 1 && <ChevronRight className="sf-essentials-breadcrumb-separator" size={13} aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
