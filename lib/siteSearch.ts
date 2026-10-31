import { getAllCmsContent } from '@/lib/site'
import type { Lang } from '@/types/entityType'

type SearchResult = { slug: string; title: { en: string; bn: string }; subtitle: { en: string; bn: string }; excerpt: { en: string; bn: string }; kind: 'page' | 'report' }

function extractText(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') output.push(value)
  else if (Array.isArray(value)) value.forEach((item) => extractText(item, output))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => extractText(item, output))
  return output
}

function snippet(value: unknown, query: string): string {
  const text = extractText(value).join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const lower = text.toLocaleLowerCase()
  const index = lower.indexOf(query.toLocaleLowerCase())
  if (index < 0) return text.slice(0, 180)
  return `${index > 55 ? '…' : ''}${text.slice(Math.max(0, index - 55), index + query.length + 125)}${index + query.length + 125 < text.length ? '…' : ''}`
}

export async function searchPublicSite(query: string, lang: Lang, limit = 30): Promise<SearchResult[]> {
  const normalized = query.toLocaleLowerCase().trim()
  if (!normalized) return []
  const content = await getAllCmsContent()
  const results: SearchResult[] = []
  for (const page of content.availablePages) {
    if (page.status && page.status !== 'published') continue
    const source = content.overrides[page.slug] as Record<string, unknown> | undefined
    const title = page.title || { en: page.slug, bn: page.slug }
    const subtitle = page.subtitle || { en: '', bn: '' }
    const searchable = extractText(source || page).join(' ').toLocaleLowerCase()
    const titleText = `${title.en} ${title.bn} ${subtitle.en || ''} ${subtitle.bn || ''}`.toLocaleLowerCase()
    if (`${titleText} ${searchable}`.includes(normalized)) {
      const sourceText = lang === 'bn' ? { title: title.bn, subtitle: subtitle.bn, excerpt: snippet(source || page, normalized) } : { title: title.en, subtitle: subtitle.en, excerpt: snippet(source || page, normalized) }
      results.push({ slug: page.slug, title: { en: String(title.en || page.slug), bn: String(title.bn || title.en || page.slug) }, subtitle: { en: String(subtitle.en || ''), bn: String(subtitle.bn || '') }, excerpt: { en: sourceText.excerpt, bn: sourceText.excerpt }, kind: page.slug === '/resources' ? 'report' : 'page' })
    }
    if (results.length >= limit) break
  }
  return results
}
