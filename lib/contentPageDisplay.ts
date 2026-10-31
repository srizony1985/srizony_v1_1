import { canonicalizeCmsRoute, LEGACY_ROUTE_ALIASES } from './cms/routes'
import { getPublicSiteSnapshot, getCmsMenuIndex } from '@/lib/site'
import type { PageData } from '@/types/entityType'

export const aliases: Readonly<Record<string, string>> = LEGACY_ROUTE_ALIASES
export function resolvePagePath(path: string) { return canonicalizeCmsRoute(path) }
export async function getPage(path: string): Promise<PageData | null> { return (await getPublicSiteSnapshot(resolvePagePath(path))).page }
export async function getPageDisplay(path: string) {
  const canonicalSlug = resolvePagePath(path)
  const snapshot = await getPublicSiteSnapshot(canonicalSlug)
  return { page: snapshot.page, canonicalSlug, notFound: snapshot.notFound }
}
export async function getAllPagePaths() { return (await getCmsMenuIndex()).availablePages.map((page) => page.slug) }
