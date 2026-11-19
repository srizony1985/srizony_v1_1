'use client'

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { FeedItem } from '@/lib/cms/components'
import type { Lang } from '@/types/entityType'
import ContentFeedCard from '@/components/pages/ContentFeedCard'

type Props = {
  items: FeedItem[]
  component: string
  lang: Lang
  columns: number
  tabletColumns: number
  viewportItems: number
  gap: string
  cardWidth: string
  layoutClass: string
  emptyText: string
  showSearch?: boolean
  showCategoryFilter?: boolean
  showYearFilter?: boolean
}

const copy = (lang: Lang, en: string, bn: string) => lang === 'bn' ? bn : en

function valueFor(item: FeedItem, lang: Lang) {
  return [
    item.title?.[lang], item.title?.en, item.title?.bn,
    item.summary?.[lang], item.summary?.en, item.summary?.bn,
    item.category?.[lang], item.category?.en, item.category?.bn,
    item.location?.[lang], item.location?.en, item.location?.bn,
    item.projectStatus, item.employmentType, item.deadline, item.vacancies, item.slug,
  ].filter(Boolean).join(' ').toLocaleLowerCase()
}

function filterValue(item: FeedItem, lang: Lang) {
  if (item.component === 'project' && item.projectStatus) return item.projectStatus
  return item.category?.[lang] || item.category?.en || item.category?.bn || item.employmentType || ''
}

export default function PublicContentFeed({
  items, component, lang, columns, tabletColumns, viewportItems, gap, cardWidth, layoutClass, emptyText,
  showSearch = true, showCategoryFilter = true, showYearFilter = true,
}: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [year, setYear] = useState('')

  const filterOptions = useMemo(() => showCategoryFilter ? [...new Set(items.map((item) => filterValue(item, lang).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : [], [items, lang, showCategoryFilter])
  const years = useMemo(() => showYearFilter ? [...new Set(items.map((item) => String(item.date || '').slice(0, 4)).filter((value) => /^\d{4}$/.test(value)))].sort((a, b) => b.localeCompare(a)) : [], [items, showYearFilter])
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return items.filter((item) => {
      const matchesText = !showSearch || !needle || valueFor(item, lang).includes(needle)
      const matchesFilter = !showCategoryFilter || !category || filterValue(item, lang) === category
      const matchesYear = !showYearFilter || !year || String(item.date || '').slice(0, 4) === year
      return matchesText && matchesFilter && matchesYear
    })
  }, [items, lang, search, category, year, showSearch, showCategoryFilter, showYearFilter])
  const hasFilters = Boolean((showSearch && search) || (showCategoryFilter && category) || (showYearFilter && year))
  const hasFilterControls = showSearch || (showCategoryFilter && filterOptions.length > 0) || (showYearFilter && years.length > 0)
  const style = {
    '--sf-grid-columns': columns,
    '--sf-grid-columns-tablet': tabletColumns,
    '--sf-grid-columns-mobile': 1,
    '--sf-grid-visible-count': viewportItems,
    '--sf-grid-collection-gap': gap,
    '--sf-grid-carousel-card-width': cardWidth,
  } as CSSProperties

  return <>
    {hasFilterControls && <div className="sf-public-feed-toolbar" role="search" aria-label={copy(lang, `Search and filter ${component}`, `অনুসন্ধান ও ফিল্টার: ${component}`)}>
      {showSearch && <label className="sf-public-feed-search">
        <Search size={17} aria-hidden="true" />
        <span className="sf-sr-only">{copy(lang, 'Search published content', 'প্রকাশিত কনটেন্ট খুঁজুন')}</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy(lang, 'Search by title, keyword or location…', 'শিরোনাম, শব্দ বা অবস্থান দিয়ে খুঁজুন…')} />
      </label>}
      <div className="sf-public-feed-filters">
        {showCategoryFilter && filterOptions.length > 0 && <label className="sf-public-feed-select">
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span className="sf-sr-only">{copy(lang, 'Filter by category or status', 'ক্যাটাগরি বা অবস্থা')}</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{copy(lang, 'All categories / statuses', 'সব ক্যাটাগরি / অবস্থা')}</option>
            {filterOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>}
        {showYearFilter && years.length > 0 && <label className="sf-public-feed-select">
          <span className="sf-sr-only">{copy(lang, 'Filter by year', 'বছর অনুযায়ী')}</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">{copy(lang, 'Any year', 'যেকোনো বছর')}</option>
            {years.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>}
        {hasFilters && <button className="sf-public-feed-clear" type="button" onClick={() => { setSearch(''); setCategory(''); setYear('') }}>
          <X size={14} aria-hidden="true" /> {copy(lang, 'Clear filters', 'ফিল্টার মুছুন')}
        </button>}
      </div>
      <p className="sf-public-feed-count" aria-live="polite">{copy(lang, `${visible.length} of ${items.length} items`, `${items.length}টির মধ্যে ${visible.length}টি`)}</p>
    </div>}
    <div className={`sf-grid sf-feed-grid ${layoutClass}`} style={style}>
      {visible.map((item, index) => <ContentFeedCard key={`${item.component}-${item.id}`} item={item} lang={lang} index={index} />)}
      {visible.length === 0 && <p className="sf-feed-empty">{hasFilters ? copy(lang, 'No results match these filters. Try a different keyword or clear your filters.', 'এই ফিল্টারে কোনো ফলাফল নেই। অন্য শব্দ ব্যবহার করুন অথবা ফিল্টার মুছে ফেলুন।') : emptyText}</p>}
    </div>
  </>
}
