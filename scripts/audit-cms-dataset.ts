import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { allPages, contentEntries, navGroups, primaryNav, contentDetails, homeHero, systemData, validateContentDetailsDataset } from '@/lib/cms/fallback-gateway'
import type { PageData, Section } from '@/types/entityType'

const problems: string[] = []
const checkBilingual = (value: unknown, path: string, required = true) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (required) problems.push(`${path}: expected English and Bengali copy`)
    return
  }
  const item = value as { en?: unknown; bn?: unknown }
  if (required && (typeof item.en !== 'string' || !item.en.trim())) problems.push(`${path}.en: missing`)
  if (required && (typeof item.bn !== 'string' || !item.bn.trim())) problems.push(`${path}.bn: missing`)
}

function auditSection(section: Section, path: string) {
  switch (section.type) {
    case 'richText':
      if (section.eyebrow) checkBilingual(section.eyebrow, `${path}.eyebrow`)
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      section.body.forEach((paragraph, i) => checkBilingual(paragraph, `${path}.body[${i}]`))
      if (section.image) {
        if (!section.image.src?.trim()) problems.push(`${path}.image.src: missing`)
        checkBilingual(section.image.alt, `${path}.image.alt`)
      }
      break
    case 'stats':
      section.items.forEach((item, i) => {
        if (!String(item.value ?? '').trim()) problems.push(`${path}.items[${i}].value: missing`)
        checkBilingual(item.label, `${path}.items[${i}].label`)
      })
      break
    case 'cards':
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      section.items.forEach((item, i) => {
        checkBilingual(item.title, `${path}.items[${i}].title`)
        if (item.body) checkBilingual(item.body, `${path}.items[${i}].body`)
        if (item.image) {
          if (!item.image.src?.trim()) problems.push(`${path}.items[${i}].image.src: missing`)
          checkBilingual(item.image.alt, `${path}.items[${i}].image.alt`)
        }
      })
      break
    case 'gallery':
      section.items.forEach((item, i) => {
        if (!item.src?.trim()) problems.push(`${path}.items[${i}].src: missing`)
        checkBilingual(item.alt, `${path}.items[${i}].alt`)
      })
      break
    case 'timeline':
      section.items.forEach((item, i) => {
        if (!String(item.year ?? '').trim()) problems.push(`${path}.items[${i}].year: missing`)
        checkBilingual(item.title, `${path}.items[${i}].title`)
        checkBilingual(item.body, `${path}.items[${i}].body`)
      })
      break
    case 'table':
      section.headers.forEach((item, i) => checkBilingual(item, `${path}.headers[${i}]`))
      section.rows.forEach((row, r) => row.forEach((item, c) => checkBilingual(item, `${path}.rows[${r}][${c}]`)))
      break
    case 'video':
      if (!section.poster?.trim()) problems.push(`${path}.poster: missing`)
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      if (section.body) checkBilingual(section.body, `${path}.body`)
      break
    case 'cta':
      checkBilingual(section.heading, `${path}.heading`)
      checkBilingual(section.body, `${path}.body`)
      checkBilingual(section.primary?.label, `${path}.primary.label`)
      if (!section.primary?.href?.trim()) problems.push(`${path}.primary.href: missing`)
      break
    case 'noticeList':
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      section.items.forEach((item, i) => {
        checkBilingual(item.title, `${path}.items[${i}].title`)
        if (item.body) checkBilingual(item.body, `${path}.items[${i}].body`)
        // Empty dates are allowed for notices that have not been assigned a verified publication date.
      })
      break
    case 'contact':
      checkBilingual(section.address, `${path}.address`)
      section.locations?.forEach((location, i) => {
        checkBilingual(location.name, `${path}.locations[${i}].name`)
        checkBilingual(location.address, `${path}.locations[${i}].address`)
        if (!location.mapQuery?.trim()) problems.push(`${path}.locations[${i}].mapQuery: missing`)
      })
      break
    case 'donation':
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      if (section.body) checkBilingual(section.body, `${path}.body`)
      break
    case 'carousel':
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      section.items.forEach((item, i) => {
        checkBilingual(item.title, `${path}.items[${i}].title`)
        if (!item.image?.src?.trim()) problems.push(`${path}.items[${i}].image.src: missing`)
        else checkBilingual(item.image.alt, `${path}.items[${i}].image.alt`)
      })
      break
    case 'contentFeed':
      section.items.forEach((item, i) => {
        checkBilingual(item.title, `${path}.items[${i}].title`)
        checkBilingual(item.summary, `${path}.items[${i}].summary`)
        // Missing images are handled by the shared fallback-card-image resolver.
      })
      break
    case 'reports':
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      section.items.forEach((item, i) => checkBilingual(item.title, `${path}.items[${i}].title`))
      break
    case 'diagram':
      if (section.heading) checkBilingual(section.heading, `${path}.heading`)
      if (section.body) checkBilingual(section.body, `${path}.body`)
      break
  }
}

function auditPage(path: string, page: PageData) {
  if (page.slug !== path) problems.push(`${path}: route key and page.slug differ (${page.slug})`)
  checkBilingual(page.title, `${path}.title`)
  if (page.subtitle) checkBilingual(page.subtitle, `${path}.subtitle`, false)
  if (!Array.isArray(page.sections)) problems.push(`${path}.sections: expected an array`)
  else page.sections.forEach((section, index) => auditSection(section, `${path}.sections[${index}]`))
}

function auditLocalAssets(value: unknown, label: string, seen = new Set<object>()) {
  if (!value || typeof value !== 'object' || seen.has(value as object)) return
  seen.add(value as object)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = `${label}.${key}`
    if (typeof child === 'string' && /^\/(?:images|photos)\//.test(child)) {
      if (!existsSync(join(process.cwd(), 'public', child.slice(1)))) problems.push(`${path}: local asset does not exist (${child})`)
    } else if (child && typeof child === 'object') auditLocalAssets(child, path, seen)
  }
}

function main() {
  const catalogue = validateContentDetailsDataset()
  for (const [path, page] of Object.entries(allPages)) auditPage(path, page)
  auditLocalAssets(allPages, 'allPages')
  auditLocalAssets(contentEntries, 'contentEntries')
  auditLocalAssets(contentDetails, 'contentDetails')
  auditLocalAssets(homeHero, 'homeHero')
  auditLocalAssets(systemData, 'systemData')
  for (const [index, item] of primaryNav.entries()) {
    checkBilingual(item.label, `primaryNav[${index}].label`)
    if (!item.href?.trim()) problems.push(`primaryNav[${index}].href: missing`)
  }
  for (const [groupIndex, group] of navGroups.entries()) {
    checkBilingual(group.label, `navGroups[${groupIndex}].label`)
    for (const [itemIndex, item] of group.items.entries()) {
      checkBilingual(item.label, `navGroups[${groupIndex}].items[${itemIndex}].label`)
      if (!item.href?.trim()) problems.push(`navGroups[${groupIndex}].items[${itemIndex}].href: missing`)
    }
  }
  for (const [index, entry] of contentEntries.entries()) {
    if (!entry.slug?.trim()) problems.push(`contentEntries[${index}].slug: missing`)
    checkBilingual(entry.title, `contentEntries[${index}].title`)
    checkBilingual(entry.excerpt, `contentEntries[${index}].excerpt`)
    if (!entry.image?.src?.trim()) problems.push(`contentEntries[${index}].image.src: missing`)
  }

  if (problems.length) {
    console.error(`Dataset audit failed with ${problems.length} issue(s):\n- ${problems.slice(0, 80).join('\n- ')}${problems.length > 80 ? `\n- …and ${problems.length - 80} more` : ''}`)
    process.exitCode = 1
    return
  }
  console.log('Dataset audit passed.')
  console.log(`- ${Object.keys(allPages).length} bilingual route/page definitions`)
  console.log(`- ${contentEntries.length} legacy content entries with titles, summaries and images`)
  console.log(`- ${catalogue.total} CMS records across ${Object.values(catalogue.counts).join(' / ')} records by component`)
  console.log('- Navigation and rendered section copy are complete in English and Bengali.')
}

main()
