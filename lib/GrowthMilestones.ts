import type { Lang } from '@/types/entityType'

export type L = Partial<Record<Lang, string>>

export interface Milestone {
  year: number
  /** One-line headline for the year */
  title?: L
  /** Short paragraph */
  summary?: L
  /** Bullet list of achievements */
  achievements?: L[]
  /** Key numbers for the year */
  stats?: { label: L; value: string }[]
  /** Optional photograph (put files in /public or use a trusted HTTPS asset URL) */
  photo?: { src: string; alt: L }
  /** Gets a red fruit on the tree. Defaults to every 5th year. */
  featured?: boolean
}

export const GROWTH_TREE_SETTING_KEY = 'homepage.growth-tree'
export const START_YEAR = 1985
export const END_YEAR = 2026
export const GROWTH_TREE_YEAR_COUNT = END_YEAR - START_YEAR + 1

export const pick = (value: L | undefined, lang: Lang): string => value?.[lang] ?? value?.en ?? ''

/**
 * First-run content. CMS edits are persisted in site_settings under
 * GROWTH_TREE_SETTING_KEY; this array remains the safe bootstrap fallback.
 */
const DETAILS: Record<number, Omit<Milestone, 'year'>> = {
  1985: { title: { en: 'Srizony Foundation begins its journey' }, featured: true },
  2026: { title: { en: '42 years of impact, and still growing' }, featured: true },
}

export const DEFAULT_GROWTH_MILESTONES: Milestone[] = Array.from(
  { length: GROWTH_TREE_YEAR_COUNT },
  (_, index) => {
    const year = START_YEAR + index
    return { year, ...DETAILS[year] }
  },
)

export const MILESTONES = DEFAULT_GROWTH_MILESTONES

function normalizeBilingual(value: unknown, maxLength = 1200): L | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const en = typeof record.en === 'string' ? record.en.trim().slice(0, maxLength) : ''
  const bn = typeof record.bn === 'string' ? record.bn.trim().slice(0, maxLength) : ''
  if (!en && !bn) return undefined
  return { ...(en ? { en } : {}), ...(bn ? { bn } : {}) }
}

/** Normalize untrusted API/JSON data and preserve the fixed 1985–2026 timeline. */
export function normalizeGrowthMilestones(value: unknown): Milestone[] {
  if (!Array.isArray(value) || value.length !== GROWTH_TREE_YEAR_COUNT) return DEFAULT_GROWTH_MILESTONES.map((item) => ({ ...item }))

  const byYear = new Map<number, Milestone>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_GROWTH_MILESTONES.map((item) => ({ ...item }))
    const item = raw as Record<string, unknown>
    const year = Number(item.year)
    if (!Number.isInteger(year) || year < START_YEAR || year > END_YEAR || byYear.has(year)) {
      return DEFAULT_GROWTH_MILESTONES.map((entry) => ({ ...entry }))
    }

    const achievements = Array.isArray(item.achievements)
      ? item.achievements.slice(0, 12).map((entry) => normalizeBilingual(entry, 600)).filter((entry): entry is L => Boolean(entry))
      : []
    const stats = Array.isArray(item.stats)
      ? item.stats.slice(0, 8).flatMap((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
          const stat = entry as Record<string, unknown>
          const label = normalizeBilingual(stat.label, 120)
          const statValue = typeof stat.value === 'string' || typeof stat.value === 'number' ? String(stat.value).trim().slice(0, 60) : ''
          return label && statValue ? [{ label, value: statValue }] : []
        })
      : []

    let photo: Milestone['photo']
    if (item.photo && typeof item.photo === 'object' && !Array.isArray(item.photo)) {
      const rawPhoto = item.photo as Record<string, unknown>
      const src = typeof rawPhoto.src === 'string' ? rawPhoto.src.trim().slice(0, 1000) : ''
      const alt = normalizeBilingual(rawPhoto.alt, 240)
      if (src && (/^\/(?!\/)/.test(src) || /^https:\/\//i.test(src))) photo = { src, alt: alt ?? {} }
    }

    const title = normalizeBilingual(item.title, 240)
    const summary = normalizeBilingual(item.summary, 1200)
    byYear.set(year, {
      year,
      ...(title ? { title } : {}),
      ...(summary ? { summary } : {}),
      ...(achievements.length ? { achievements } : {}),
      ...(stats.length ? { stats } : {}),
      ...(photo ? { photo } : {}),
      ...(typeof item.featured === 'boolean' ? { featured: item.featured } : {}),
    })
  }

  const normalized = Array.from({ length: GROWTH_TREE_YEAR_COUNT }, (_, index) => byYear.get(START_YEAR + index))
  if (normalized.some((item) => !item)) return DEFAULT_GROWTH_MILESTONES.map((item) => ({ ...item }))
  return normalized as Milestone[]
}
