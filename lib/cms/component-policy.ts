import type { LandingComponentKey as LandingComponentKeyModel, PageSection, Section } from '@/types/entityType'

/** Landing compositions are intentionally a strict subset of the page section model. */
export type LandingComponentKey = LandingComponentKeyModel

export const LANDING_COMPONENT_TYPE = {
  hero: 'carousel',
  growth: 'stats',
  missionVisionValues: 'cards',
  locations: 'richText',
  developmentAreas: 'cards',
  news: 'carousel',
  successStories: 'carousel',
  /** @deprecated Legacy CMS identity; normalized to `news` when reading the homepage. */
  stories: 'carousel',
  /** @deprecated Legacy identity used by an earlier homepage editor. */
  newsFeed: 'carousel',
  donate: 'cta',
} satisfies Record<LandingComponentKey, Section['type']>
export const LANDING_COMPONENT_KEYS = Object.keys(LANDING_COMPONENT_TYPE) as LandingComponentKey[]
export const LANDING_COMPONENT_OPTIONS = [
  { key: 'hero', label: 'Hero / feature carousel', labelBn: 'হিরো / ফিচার ক্যারোসেল', type: 'carousel' },
  { key: 'growth', label: 'Growth / impact statistics', labelBn: 'উন্নয়ন ও প্রভাবের পরিসংখ্যান', type: 'stats' },
  { key: 'missionVisionValues', label: 'Mission, vision & values', labelBn: 'মিশন, ভিশন ও মূল্যবোধ', type: 'cards' },
  { key: 'locations', label: 'Office locations / footprint', labelBn: 'কার্যালয় ও অবস্থান', type: 'richText' },
  { key: 'developmentAreas', label: 'Development areas', labelBn: 'উন্নয়ন কার্যক্রমের ক্ষেত্র', type: 'cards' },
  { key: 'news', label: 'News rail', labelBn: 'সংবাদ রেল', type: 'carousel' },
  { key: 'successStories', label: 'Success stories gallery', labelBn: 'সাফল্যের গল্পের গ্যালারি', type: 'carousel' },
  { key: 'donate', label: 'Donation call to action', labelBn: 'অনুদানের আহ্বান', type: 'cta' },
] as const

export function isLandingComponentKey(value: unknown): value is LandingComponentKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LANDING_COMPONENT_TYPE, value)
}

/**
 * A normal page can use normal sections and may opt into a landing composition.
 * The home page can only contain registered landing compositions.
 */
export function validatePageComponentLayers(slug: string, sections: unknown): string | null {
  if (!Array.isArray(sections)) return 'Page sections must be an array.'
  for (const [index, value] of sections.entries()) {
    if (!value || typeof value !== 'object' || typeof (value as { type?: unknown }).type !== 'string') {
      return `Section ${index + 1} has an invalid content type.`
    }
    const section = value as PageSection
    const key = (section as PageSection).homeComponent
    if (slug === '/') {
      if (!isLandingComponentKey(key)) return `Landing section ${index + 1} must use a registered landing component.`
      if (LANDING_COMPONENT_TYPE[key] !== section.type) return `Landing component “${key}” requires the “${LANDING_COMPONENT_TYPE[key]}” section type.`
      continue
    }
    if (key !== undefined && key !== null) {
      if (!isLandingComponentKey(key)) return `Section ${index + 1} uses an unknown landing component.`
      if (LANDING_COMPONENT_TYPE[key] !== section.type) return `Landing component “${key}” requires the “${LANDING_COMPONENT_TYPE[key]}” section type.`
    }
    // Keep the Section discriminator constrained to the normal page renderer's registry.
    const validTypes: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']
    if (!validTypes.includes(section.type)) return `Section ${index + 1} uses an unsupported page component.`
  }
  return null
}
