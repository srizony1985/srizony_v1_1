import type { Section } from '../../types/entityType'

/**
 * Component types that may be selected for a page's collection feed.
 * Keep this list shared by the CMS editor, admin API and public navigation.
 */
export const RENDERED_COMPONENT_TYPES: Section['type'][] = [
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

const validComponentTypes = new Set<string>(RENDERED_COMPONENT_TYPES)
const wrapperKeys = [
  'renderedComponents',
  'rendered_components',
  'contentTypes',
  'content_types',
  'components',
  'selectedComponents',
  'selected_components',
  'types',
  'items',
  'value',
  'type',
  'component',
  'name',
] as const

/**
 * PostgreSQL JSONB values normally arrive as arrays, but legacy imports and
 * older API writes can leave strings or objects in `content_types`. Normalize
 * those shapes defensively so one malformed row cannot take down navigation.
 */
function collectCandidates(value: unknown, depth = 0): unknown[] {
  if (depth > 6 || value == null) return []

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'string') return [entry]
      if (Array.isArray(entry) || (typeof entry === 'object' && entry !== null)) {
        return collectCandidates(entry, depth + 1)
      }
      return [entry]
    })
  }

  if (typeof value === 'string') {
    const candidate = value.trim()
    if (!candidate) return []

    try {
      const parsed: unknown = JSON.parse(candidate)
      if (parsed !== candidate) return collectCandidates(parsed, depth + 1)
    } catch {
      // Accept the old comma/pipe-delimited representation as well as a
      // single component name. Unknown legacy names are filtered below.
    }

    return candidate.split(/[,|]/).map((part) => part.trim()).filter(Boolean)
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>

    for (const key of wrapperKeys) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const nested = collectCandidates(record[key], depth + 1)
        if (nested.length) return nested
      }
    }

    // Some legacy payloads are stored as { cards: true, gallery: false }.
    return Object.entries(record)
      .filter(([key, enabled]) => validComponentTypes.has(key) && (enabled === true || enabled === 1 || enabled === 'true'))
      .map(([key]) => key)
  }

  return []
}

/**
 * Returns a safe, de-duplicated component list. An empty or legacy-only value
 * intentionally means "all supported components" to preserve existing pages.
 */
export function parseRenderedComponents(value: unknown): Section['type'][] {
  const valid = collectCandidates(value)
    .filter((candidate): candidate is Section['type'] =>
      typeof candidate === 'string' && validComponentTypes.has(candidate.trim()),
    )
    .map((candidate) => candidate.trim() as Section['type'])

  return valid.length
    ? Array.from(new Set(valid))
    : [...RENDERED_COMPONENT_TYPES]
}
