import type { PageData } from '@/types/entityType'

/** Location directory maps are allowed only on Home and the Contact page family. */
export function supportsLocationMap(slug: string | undefined): boolean {
  const path = String(slug ?? '').split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  return path === '/' || path === '/contact' || path === '/contact-us'
}

/** A map is always opt-in, even on a supported route. */
export function shouldRenderLocationMap(page: Pick<PageData, 'slug' | 'showContactMap'> | null | undefined): boolean {
  return Boolean(page && supportsLocationMap(page.slug) && page.showContactMap === true)
}
