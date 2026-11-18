import type { ExternalRecord, ExternalValue } from '../types/json'

/**
 * Landing-page image plan.
 *
 * Every picture on the homepage (hero rail, legacy block, SDG cards, enterprise
 * cards and field-news cards) comes from ONE pool, and each pool entry is used
 * at most once on that page. The hard-coded assignments below are the
 * defaults; `dedupeLandingSections` / `prepareHeroSlides` enforce the same rule
 * at runtime so older CMS/database content with repeated pictures is corrected
 * on screen too.
 *
 * Pure data + pure functions: safe to import from server, seed and client code.
 * Photos are illustrative stock images (see data/open-image-sources.md); local
 * files under /public/photos are real community photographs already in the
 * project (de-duplicated from the former /public/images copies).
 */

const U = (id: string, w = 1800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=85`

export type PoolEntry = { url: string; tags: string[] }

export const IMAGE_POOL = {
  // ── remote photographs already used by the project ───────────────────
  community: { url: U('1766858669684-4e501b3b9f9f'), tags: ['community', 'rural', 'development', 'people'] },
  education: { url: U('1777725770744-e66b802dbf60'), tags: ['education', 'student', 'learning', 'book', 'school'] },
  agriculture: { url: U('1761961851508-43db0337480a'), tags: ['agriculture', 'farm', 'rice', 'hunger', 'food'] },
  rights: { url: U('1722932592507-59b3a3ac368d'), tags: ['rights', 'governance', 'voice', 'advocacy'] },
  village: { url: U('1681672705104-c78e31a8d111'), tags: ['partnership', 'village', 'rural', 'river'] },
  climate: { url: U('1668940004859-c3b8249e8067'), tags: ['climate', 'resilience', 'environment', 'field'] },
  farming: { url: U('1738233505102-1bd26c33679e'), tags: ['livelihood', 'enterprise', 'farming', 'work'] },
  health: { url: U('1576091160399-112ba8d25d1d'), tags: ['health', 'care', 'medical'] },
  digital: { url: U('1516321318423-f06f85e504b3'), tags: ['internet', 'digital', 'computer', 'technology'] },
  campus: { url: U('1562774053-701939374585'), tags: ['university', 'campus', 'higher', 'education'] },
  office: { url: U('1497366754035-f200968a6e72'), tags: ['printing', 'press', 'office', 'publication'] },
  water: { url: U('1548839140-29a749e1cf4d'), tags: ['water', 'sanitation'] },
  schoolgirls: { url: U('1573894998033-c0cef4ed722b'), tags: ['education', 'school', 'girls', 'classroom'] },
  womenInAgriculture: { url: U('1774504798125-bd6eed7063fc'), tags: ['gender', 'women', 'agriculture', 'trees'] },
  clinic: { url: U('1774979161296-bb930552543a'), tags: ['clinic', 'primary', 'health', 'urban'] },
  communityAction: { url: U('1722944759942-791464a16ee0'), tags: ['governance', 'participation', 'civic', 'voice'] },
  solar: { url: U('1784623305001-c7aebfc7f226'), tags: ['energy', 'solar', 'power'] },
  riceFarmer: { url: U('1558289282-647de9fdf608'), tags: ['irrigation', 'rice', 'farmer'] },
  waterHands: { url: U('1574482620811-1aa16ffe3c82'), tags: ['water', 'hygiene', 'sanitation', 'clean'] },
  sewing: { url: U('1765658559220-6b51dbabe850'), tags: ['finance', 'micro', 'work', 'growth', 'business'] },
  floodResilience: { url: U('1759261158814-e5c651e30714'), tags: ['disaster', 'flood', 'resilience'] },
  handwashing: { url: U('1780504863172-22655ab910ae'), tags: ['water', 'sanitation', 'hygiene', 'drinking'] },
  elderly: { url: U('1771699435693-52329f0d18ff'), tags: ['nutrition', 'market', 'elderly', 'health'] },
  cleanCooking: { url: U('1697378149850-0910bce142b7'), tags: ['cook', 'stove', 'kitchen', 'clean'] },
  sportsField: { url: U('1760510088582-3ca0631ad84f'), tags: ['sports', 'culture', 'play'] },
  childrenCommunity: { url: U('1780282148151-e53f763cbb30'), tags: ['children', 'protection', 'adolescent'] },
  mobileMoney: { url: U('1681826291722-70bd7e9e6fc3'), tags: ['remittance', 'transfer', 'mobile', 'money'] },
  villageHome: { url: U('1767154966831-9607c8322a5a'), tags: ['poverty', 'housing', 'home', 'village'] },
  elderlyBangladesh: { url: U('1758726948996-c2390f716d70'), tags: ['elderly', 'older', 'dignity'] },
  // ── newly sourced (Unsplash licence, Bangladesh) ─────────────────────
  riceSunset: { url: U('1597356420268-4289c0bbe55d'), tags: ['mobility', 'motors', 'rural', 'road'] },
  fieldPath: { url: U('1739073677749-5e0f1a1487df'), tags: ['filling', 'station', 'road', 'fuel'] },
  dhakaBuilding: { url: U('1687346394692-7860c0713e51'), tags: ['hospital', 'building', 'urban', 'centre'] },
  // ── local community photographs (served from /public/photos) ─────────
  localMarket: { url: '/photos/market-women.jpg', tags: ['market', 'women', 'livelihood', 'work', 'growth'] },
  localGathering: { url: '/photos/women-gathering.jpg', tags: ['legacy', 'community', 'elders', 'gathering'] },
  localChildren: { url: '/photos/children-learning.jpg', tags: ['computer', 'garden', 'learning', 'children'] },
  localSchool: { url: '/photos/school-children.jpg', tags: ['education', 'skills', 'school', 'children'] },
  localTraining: { url: '/photos/women-training.jpg', tags: ['polytechnic', 'training', 'skills', 'technical'] },
} as const satisfies Record<string, PoolEntry>

export type PoolKey = keyof typeof IMAGE_POOL
export const poolUrl = (key: PoolKey) => IMAGE_POOL[key].url

/** Stable identity of a picture, ignoring crop/size query parameters. */
export const imageKey = (src: string) => {
  const m = /photo-([\w-]+)/.exec(src)
  return m ? m[1] : src.split('?')[0]
}

/** Hero rail: a curated, theme-diverse set of 12 projects, each with its own picture. */
export const HERO_FEATURED: { slug: string; image: PoolKey; title: { en: string; bn: string } }[] = [
  { slug: 'enrich', image: 'community', title: { en: 'Community-led development', bn: 'কমিউনিটি নেতৃত্বাধীন উন্নয়ন' } },
  { slug: 'protection-of-working-children', image: 'childrenCommunity', title: { en: 'Protecting working children', bn: 'শ্রমজীবী শিশুর সুরক্ষা' } },
  { slug: 'second-chance-education', image: 'education', title: { en: 'Second chance education', bn: 'দ্বিতীয় সুযোগের শিক্ষা' } },
  { slug: 'urban-primary-health-care', image: 'clinic', title: { en: 'Urban primary healthcare', bn: 'নগর প্রাথমিক স্বাস্থ্যসেবা' } },
  { slug: 'micro-finance-program', image: 'sewing', title: { en: 'Micro finance for families', bn: 'পরিবারের জন্য ক্ষুদ্রঋণ' } },
  { slug: 'disaster-management', image: 'floodResilience', title: { en: 'Disaster preparedness', bn: 'দুর্যোগ প্রস্তুতি' } },
  { slug: 'safe-drinking-water-sanitation', image: 'handwashing', title: { en: 'Safe water, better sanitation', bn: 'নিরাপদ পানি, উন্নত স্যানিটেশন' } },
  { slug: 'solar-irrigation-pumping-system', image: 'riceFarmer', title: { en: 'Solar irrigation pumps', bn: 'সোলার সেচ পাম্প' } },
  { slug: 'improve-cook-stove', image: 'cleanCooking', title: { en: 'Cleaner cook stoves', bn: 'পরিচ্ছন্ন চুলা' } },
  { slug: 'human-rights-and-good-governance', image: 'rights', title: { en: 'Rights and good governance', bn: 'অধিকার ও সুশাসন' } },
  { slug: 'remittance-transfer-program', image: 'mobileMoney', title: { en: 'Remittance transfer services', bn: 'রেমিট্যান্স ট্রান্সফার সেবা' } },
  { slug: 'uplifting-quality-of-life-elderly', image: 'elderlyBangladesh', title: { en: 'Dignity for older people', bn: 'বয়স্কদের জন্য মর্যাদা' } },
]
export const HERO_MAX_SLIDES = HERO_FEATURED.length

/** SDG card backgrounds (goal number → picture), disjoint from the hero rail. */
export const SDG_IMAGE_KEYS: Record<string, PoolKey> = {
  '1': 'villageHome',
  '2': 'agriculture',
  '3': 'health',
  '4': 'schoolgirls',
  '5': 'womenInAgriculture',
  '6': 'waterHands',
  '7': 'solar',
  '8': 'localMarket',
}
export const SDG_BACKGROUND_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(SDG_IMAGE_KEYS).map(([n, key]) => [n, IMAGE_POOL[key].url]),
)

/** Default pictures for the legacy block, enterprise cards and field-news cards. */
export const LEGACY_IMAGE: PoolKey = 'localGathering'
export const SLUG_IMAGE_KEYS: Record<string, PoolKey> = {
  // enterprise cards
  'srizony-hospital': 'dhakaBuilding',
  'srizony-university': 'campus',
  'srizony-polytechnic': 'localTraining',
  'srizony-printing-press': 'office',
  'srizony-filling-station': 'fieldPath',
  'srizony-internet': 'digital',
  'srizony-computer-garden': 'localChildren',
  'srizony-motors': 'riceSunset',
  // field-news cards
  'community-health-and-nutrition-update': 'elderly',
  'livelihood-and-enterprise-update': 'farming',
  'education-and-skills-update': 'localSchool',
  'community-rights-and-governance-update': 'communityAction',
  'climate-resilience-update': 'climate',
  'community-partnership-update': 'village',
}

/**
 * Provides a relevant, already-approved project photo when a linked CMS card
 * has no image attached. Existing editor-supplied images always take priority.
 */
export function fallbackCardImage(title: { en?: string; bn?: string }, href?: string): string {
  const slug = (href || '').split(/[?#]/, 1)[0].split('/').filter(Boolean).pop()?.toLowerCase() || ''
  const exactKey = SLUG_IMAGE_KEYS[slug]
  if (exactKey) return IMAGE_POOL[exactKey].url

  const titleText = `${title.en || ''} ${href || ''}`.toLowerCase()
  const words = titleText.split(/[^a-z0-9]+/).filter((word) => word.length > 2)
  let bestKey: PoolKey = 'community'
  let bestScore = 0
  for (const [key, entry] of Object.entries(IMAGE_POOL) as [PoolKey, PoolEntry][]) {
    const score = entry.tags.reduce((total, tag) => {
      const normalized = tag.toLowerCase()
      return total + (words.some((word) => word === normalized || word.startsWith(normalized) || normalized.startsWith(word)) ? 1 : 0)
    }, 0)
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }
  return IMAGE_POOL[bestKey].url
}

/* ------------------------------------------------------------------ */
/* Runtime guards                                                       */
/* ------------------------------------------------------------------ */

type Bi = { en: string; bn: string }
type Slide = { id: string; image: string; title: Bi; description: Bi; href: string }

const countWords = (text: string | undefined) => (text || '').split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length

/** Keep at most `max` words (punctuation-only tokens such as “&” or “—” do not count). */
export function limitWords(text: string | undefined, max = 3): string {
  const source = (text || '').trim()
  if (!source) return ''
  // Known editorial headlines get compact rewrites instead of awkward cut-offs.
  const normalized = source.toLowerCase().replace(/[.!?]+$/u, '')
  if (max >= 3 && normalized === 'impact areas that matter') return 'Impact That Matters'
  if (max >= 2 && normalized === 'news from the field') return 'Field News'
  const tokens = source.split(/\s+/)
  const out: string[] = []
  let words = 0
  for (const token of tokens) {
    const isWord = /[\p{L}\p{N}]/u.test(token)
    if (isWord && words >= max) break
    out.push(token)
    if (isWord) words += 1
  }
  while (out.length && !/[\p{L}\p{N}]/u.test(out[out.length - 1])) out.pop()
  return out.join(' ').replace(/[,:;–—-]+$/u, '').trim()
}

export const limitBilingual = (value: Bi, max = 3): Bi => ({ en: limitWords(value.en, max), bn: limitWords(value.bn, max) })

/**
 * Hero rail: featured projects first (in curated order, with their own picture),
 * then any other slide whose picture is still unused. Titles remain intact; CSS handles wrapping.
 */
export function prepareHeroSlides<T extends Slide>(slides: T[]): T[] {
  const featuredBySlug = new Map(HERO_FEATURED.map((f) => [f.slug, f]))
  const bySlug = new Map<string, T>()
  for (const slide of slides) {
    const slug = slide.id.replace(/^project-/, '')
    if (featuredBySlug.has(slug) && !bySlug.has(slug)) bySlug.set(slug, slide)
  }
  const reserved = new Set(Object.values(SDG_BACKGROUND_URLS).map(imageKey))
  const used = new Set<string>()
  const result: T[] = []
  for (const f of HERO_FEATURED) {
    const base = bySlug.get(f.slug)
    if (!base) continue
    const image = IMAGE_POOL[f.image].url
    used.add(imageKey(image))
    const own = base.title && (countWords(base.title.en) > 0 || countWords(base.title.bn) > 0)
    result.push({ ...base, image, title: own ? base.title : f.title })
  }
  for (const slide of slides) {
    if (result.length >= HERO_MAX_SLIDES) break
    const slug = slide.id.replace(/^project-/, '')
    if (featuredBySlug.has(slug)) continue
    const key = imageKey(slide.image)
    if (used.has(key) || reserved.has(key)) continue
    used.add(key)
    result.push({ ...slide })
  }
  return result
}

type LandingMedia = ExternalRecord & { src: string; alt?: Bi }

function asExternalRecord(value: ExternalValue): ExternalRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ExternalRecord
    : null
}

function readString(record: ExternalRecord | null, key: string): string {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Walk landing sections in page order and make sure no picture repeats —
 * neither inside the sections nor against the hero rail or the SDG cards.
 * A repeated picture is replaced by the best topical match that is still unused.
 */
export function dedupeLandingSections<S extends object>(sections: S[], heroSlides: { image: string }[], namespace = ''): S[] {
  const used = new Set<string>([...heroSlides.map((slide) => imageKey(slide.image)), ...Object.values(SDG_BACKGROUND_URLS).map(imageKey)])
  const entries = Object.values(IMAGE_POOL) as PoolEntry[]
  const namespaceHash = [...namespace].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0)
  const take = (title: string, current?: string) => {
    if (current && !used.has(imageKey(current))) {
      used.add(imageKey(current))
      return current
    }
    const words = `${namespace} ${title}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    let best: PoolEntry | null = null
    let bestScore = -1
    for (let offset = 0; offset < entries.length; offset += 1) {
      const entry = entries[(offset + namespaceHash) % entries.length]
      if (used.has(imageKey(entry.url))) continue
      const score = entry.tags.reduce((total, tag) => total + (words.some((word) => tag.startsWith(word) || word.startsWith(tag)) ? 1 : 0), 0)
      if (score > bestScore) {
        best = entry
        bestScore = score
      }
    }
    if (!best) return current || ''
    used.add(imageKey(best.url))
    return best.url
  }

  const fix = (media: ExternalValue, title: string): ExternalValue => {
    if (typeof media === 'string') return media ? take(title, media) : media
    const record = asExternalRecord(media)
    if (record && typeof record.src === 'string') {
      return { ...record, src: take(title, record.src) } as LandingMedia
    }
    return media
  }

  return sections.map((sectionValue) => {
    const section = asExternalRecord(sectionValue)
    if (!section) return sectionValue
    const heading = asExternalRecord(section.heading)
    const sectionTitle = readString(heading, 'en') || 'legacy'

    if (section.type === 'richText' && section.image) {
      return { ...section, image: fix(section.image, sectionTitle) } as S
    }
    if (section.type === 'gallery' && Array.isArray(section.items)) {
      const items = section.items.map((mediaValue: ExternalValue, index: number) => {
        const mediaRecord = asExternalRecord(mediaValue)
        const alt = asExternalRecord(mediaRecord?.alt)
        const title = readString(alt, 'en') || `${namespace} gallery ${index + 1}`
        return fix(mediaValue, title)
      })
      return { ...section, items } as S
    }
    if (section.type === 'cards' && section.variant === 'impact') return sectionValue
    if ((section.type === 'cards' || section.type === 'carousel') && Array.isArray(section.items)) {
      const items = section.items.map((itemValue: ExternalValue) => {
        const item = asExternalRecord(itemValue)
        if (!item) return itemValue
        const itemTitle = asExternalRecord(item.title)
        const title = readString(itemTitle, 'en') || readString(item, 'title_en') || readString(item, 'href') || 'Community programme'
        const href = readString(item, 'href')
        if (item.image) return { ...item, image: fix(item.image, `${title} ${href}`) }
        if (item.image_src || item.image_url) {
          const imageKeyName = typeof item.image_src === 'string' ? 'image_src' : 'image_url'
          return { ...item, [imageKeyName]: fix(item[imageKeyName], `${title} ${href}`) }
        }
        // ContentCard generates fallback photography for image-less cards.
        // Materialize that fallback here so every card on this page gets a unique
        // image, while keeping the icon-only impact grid photo-free.
        if (item.illustration) return itemValue
        const image = take(`${title} ${href}`)
        return image ? { ...item, image: { src: image, alt: { en: title, bn: readString(itemTitle, 'bn') || title }, kind: 'image' } } : itemValue
      })
      return { ...section, items } as S
    }
    return sectionValue
  })
}
