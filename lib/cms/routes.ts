/** Canonical public routes shared by the CMS, seeded content, and the page router. */
import { CONTENT_COLLECTION_ROUTES } from './components'

export const LANDING_ROUTE = '/' as const

/**
 * Legacy flat/collection URLs mapped to the current navigation hierarchy.
 * These aliases are permanent compatibility redirects; canonical pages are stored
 * only at the route that appears in the menu tree.
 */
export const LEGACY_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  '/home': '/',
  '/project': '/projects',
  '/enterprise': '/enterprise-development',
  '/partner-agency': '/about-us/partners-networks',
  '/partners': '/about-us/partners-networks',
  '/partners-and-networks': '/about-us/partners-networks',
  '/partners-networks': '/about-us/partners-networks',
  '/health-service': '/social-development/health-program',
  '/health-program': '/social-development/health-program',
  '/loan-product': '/organizational-development',
  '/loans': '/organizational-development',
  '/product': '/enterprise-development',
  '/social-enterprise': '/enterprise-development',
  '/team': '/management-staff',
  '/report': '/resources',
  '/reports': '/resources',
  // News and Success Stories each have one canonical collection page at the root.
  // Old nested collection URLs redirect to these canonical roots; article detail
  // paths remain /news/{slug} and /success-stories/{slug}.
  '/what-we-do/news': '/news',
  '/what-we-do/success-stories': '/success-stories',
  '/success-story': '/success-stories',
  '/category/news': '/news',
  '/category/projects': '/projects',
  '/notices': '/notice',
  '/about': '/about-us',
  '/govorning-body': '/about-us/governing-body',
  '/governing-body': '/about-us/governing-body',
  '/good-govornance': '/good-governance',
  '/executive-secratariat': '/executive-secretariat',
  '/organizetional-development': '/organizational-development',
  '/job-circulars': '/carrer-job',
  '/job-circular': '/carrer-job',
  '/career': '/carrer-job',
  '/career-job': '/carrer-job',
  '/donate-now': '/donate',
  '/founders-footprint': '/about-us/founders-footprint',
  '/awards-recognition': '/about-us/awards-recognition',
  '/executive-committee': '/about-us/executive-committee',
  '/operational-structure': '/about-us/operational-structure',
  '/education-program': '/social-development/education-program',
  '/human-rights': '/social-development/human-rights',
  '/human-resource': '/social-development/human-resource',
  '/climate-change': '/social-development/climate-change',
  '/agriculture-livelihood': '/social-development/agriculture-livelihood',
  '/women-business-loan': '/organizational-development/women-business-loan',
  '/small-enterprise-loan': '/organizational-development/small-enterprise-loan',
  '/agri-development-loan': '/organizational-development/agri-development-loan',
  '/household-migrant-loan': '/organizational-development/household-migrant-loan',
  '/rural-development-loan': '/organizational-development/rural-development-loan',
  '/job-holders-loan': '/organizational-development/job-holders-loan',
  '/student-loan': '/organizational-development/student-loan',
  '/student-looan': '/organizational-development/student-loan',
}

const LEGACY_DETAIL_PREFIX_ALIASES: ReadonlyArray<{ prefix: string; target: string }> = [
  { prefix: '/what-we-do/news/', target: '/news/' },
  { prefix: '/what-we-do/success-stories/', target: '/success-stories/' },
  { prefix: '/success-story/', target: '/success-stories/' },
  { prefix: '/category/news/', target: '/news/' },
]

// Exact collection aliases redirect the old index URL to the canonical root page.
// Nested article URLs are handled first by LEGACY_DETAIL_PREFIX_ALIASES.
const EXACT_ONLY_ALIASES = new Set(['/what-we-do/news', '/what-we-do/success-stories', '/success-story', '/category/news'])
const CONTENT_DETAIL_PARENTS = new Set(['/news', '/success-stories'])

/** Normalize legacy URLs to the single canonical collection and detail routes. */
export function canonicalizeCmsRoute(path: string): string {
  const normalized = path && path.length > 1 ? path.replace(/\/+$/, '') : (path || LANDING_ROUTE)
  const legacyDetail = LEGACY_DETAIL_PREFIX_ALIASES.find(({ prefix }) => normalized.startsWith(prefix))
  if (legacyDetail) return `${legacyDetail.target}${normalized.slice(legacyDetail.prefix.length)}`.replace(/\/{2,}/g, '/') || LANDING_ROUTE
  if (LEGACY_ROUTE_ALIASES[normalized]) return LEGACY_ROUTE_ALIASES[normalized]
  const aliasPrefix = Object.keys(LEGACY_ROUTE_ALIASES)
    .filter((prefix) => !EXACT_ONLY_ALIASES.has(prefix))
    .sort((a, b) => b.length - a.length)
    .find((prefix) => normalized.startsWith(`${prefix}/`))
  return aliasPrefix
    ? `${LEGACY_ROUTE_ALIASES[aliasPrefix]}${normalized.slice(aliasPrefix.length)}`.replace(/\/{2,}/g, '/') || LANDING_ROUTE
    : normalized || LANDING_ROUTE
}

export type TopLevelMenuSlugCheck =
  | { valid: true; path: string }
  | { valid: false; reason: 'empty' | 'nested' | 'invalid' | 'reserved-alias'; input: string; canonical?: string }

/**
 * Validate a menu slug before legacy URL aliases are applied.
 * A one-segment input such as `/partners` can otherwise be rewritten to
 * `/about-us/partners-networks` and then incorrectly reported as a nested slug.
 * Historical aliases that still redirect to unrelated existing pages are rejected.
 * Root News and Success Stories are canonical collection pages and can be menu routes;
 * their child paths remain the canonical content-detail routes.
 */
export function inspectTopLevelMenuSlug(input: string): TopLevelMenuSlugCheck {
  const raw = String(input ?? '').trim().toLowerCase().replace(/^\/+|\/+$/g, '')
  if (!raw) return { valid: false, reason: 'empty', input: '' }
  const segments = raw.split('/')
  if (segments.length !== 1) return { valid: false, reason: 'nested', input: `/${raw}` }

  const rawPath = `/${raw}`
  if (!/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawPath)) {
    return { valid: false, reason: 'invalid', input: rawPath }
  }

  const canonical = canonicalizeCmsRoute(rawPath)
  if (canonical !== rawPath && (canonical === LANDING_ROUTE || canonical.split('/').filter(Boolean).length > 1)) {
    return { valid: false, reason: 'reserved-alias', input: rawPath, canonical }
  }
  return { valid: true, path: canonical }
}

/** Build the one canonical public URL for a content item placed under a page. */
export function buildContentRoute(parentPath: string, contentSlug: string): string {
  const slug = String(contentSlug || '').trim().replace(/^\/+|\/+$/g, '')
  const rawParent = String(parentPath || LANDING_ROUTE).trim().replace(/\/+$/g, '') || LANDING_ROUTE
  const parent = CONTENT_DETAIL_PARENTS.has(rawParent) ? rawParent : canonicalizeCmsRoute(rawParent)
  if (!slug) return parent === LANDING_ROUTE ? '/content-slug' : `${parent}/content-slug`
  return parent === LANDING_ROUTE ? `/${slug}` : `${parent}/${slug}`
}

/** The page path that owns a nested content detail URL at any depth. */
export function getContentRouteParent(path: string): string {
  const normalized = canonicalizeCmsRoute(String(path || LANDING_ROUTE).replace(/\/+$/, '') || LANDING_ROUTE)
  const segments = normalized.split('/').filter(Boolean)
  return segments.length <= 1 ? LANDING_ROUTE : `/${segments.slice(0, -1).join('/')}`
}

/** Normalize a CMS-entered route, never allowing a legacy URL to be persisted. */
export function normalizeCmsRoutePath(path: string): string {
  const raw = String(path || LANDING_ROUTE).trim()
  if (raw === LANDING_ROUTE) return LANDING_ROUTE
  const normalized = canonicalizeCmsRoute(`/${raw.replace(/^\/+|\/+$/g, '')}`)
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/.test(normalized)) {
    throw new Error('CMS paths must use lowercase URL slugs separated by single slashes.')
  }
  return normalized
}

/** Is this path represented by an internal item in the active primary/menu tree? */
export function isNavigationPagePath(path: string, global: unknown): boolean {
  const requested = canonicalizeCmsRoute(path)
  if (requested === LANDING_ROUTE) return true
  if (!global || typeof global !== 'object') return false
  const root = global as Record<string, unknown>
  const seen = new Set<string>()
  const visit = (items: unknown): void => {
    if (!Array.isArray(items)) return
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      const href = typeof item.href === 'string' ? item.href : ''
      if (href.startsWith('/') && item.menuType !== 'external') seen.add(canonicalizeCmsRoute(href))
      visit(item.children)
      visit(item.items)
    }
  }
  visit(root.primaryNav)
  visit(root.navGroups)
  return seen.has(requested) || CONTENT_COLLECTION_ROUTES.some((route) => route.slug === requested)
}
