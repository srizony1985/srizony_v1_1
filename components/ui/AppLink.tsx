import Link from 'next/link'
import type { AnchorHTMLAttributes } from 'react'

export type LinkAction = 'route' | 'external' | 'anchor'

const EXTERNAL = /^(https?:)?\/\//
const NATIVE = /^(mailto:|tel:|#)/

/** The single link primitive: client route, new-tab external link, or plain anchor/mailto/tel, chosen from `action` or the href itself. */
export default function AppLink({ href, action, external, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; action?: LinkAction; external?: boolean }) {
  if (external || action === 'external' || EXTERNAL.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
  if (action === 'anchor' || NATIVE.test(href)) return <a href={href} {...props} />
  return <Link href={href} {...props} />
}
