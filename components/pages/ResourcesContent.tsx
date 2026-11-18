'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownToLine, ArrowUpRight, FileArchive, FileText, MapPin, Search, Users } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import { useWebsiteEssentials } from '@/components/hooks/useWebsiteEssentials'
import type { FeedItem } from '@/lib/cms/components'
import type { PageData } from '@/types/entityType'

type ResourceFilter = 'all' | 'reports' | 'documents'
type ResourceItem = {
  key: string
  title: string
  summary: string
  url: string
  date: string
  category: Exclude<ResourceFilter, 'all'>
  kind: 'report' | 'staff' | 'location'
}

function formatDate(value: string, lang: 'en' | 'bn') {
  if (!value) return ''
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00+06:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka',
  }).format(parsed)
}

export default function ResourcesContent({ reports = [], page }: { reports?: FeedItem[]; page?: Pick<PageData, 'title' | 'subtitle'> }) {
  const { lang, site } = useSite()
  const { essentials, loading, failed } = useWebsiteEssentials()
  const [filter, setFilter] = useState<ResourceFilter>('all')
  const [search, setSearch] = useState('')
  const bn = lang === 'bn'
  const ui = useMemo(() => site?.global.ui?.[lang] ?? {}, [site?.global.ui, lang])
  const label = useCallback((key: string, fallback: string) => ui[`resources.${key}`] || fallback, [ui])

  const resources = useMemo<ResourceItem[]>(() => {
    const officialDocuments: ResourceItem[] = [
      {
        key: 'staff-list',
        title: (bn ? essentials.documents.staffListPdf.titleBn : essentials.documents.staffListPdf.titleEn) || label('staffTitle', bn ? 'কর্মকর্তা-কর্মচারীর তালিকা' : 'Staff List'),
        summary: label('staffSummary', bn ? 'অনুমোদিত কর্মকর্তা-কর্মচারীর তালিকা PDF ফাইলে।' : 'The approved staff list, available as a PDF document.'),
        url: essentials.documents.staffListPdf.url,
        date: '', category: 'documents', kind: 'staff',
      },
      {
        key: 'working-locations',
        title: (bn ? essentials.documents.locationsPdf.titleBn : essentials.documents.locationsPdf.titleEn) || label('locationsTitle', bn ? 'কার্যালয় ও কার্যক্রমের স্থান' : 'Working Locations'),
        summary: label('locationsSummary', bn ? 'কার্যালয়, কার্যক্রমের স্থান ও শাখার তালিকা PDF ফাইলে।' : 'Head office, working locations and branch offices in one PDF directory.'),
        url: essentials.documents.locationsPdf.url,
        date: '', category: 'documents', kind: 'location',
      },
    ]
    const publishedReports: ResourceItem[] = reports.map((item) => ({
      key: `report-${item.id}`,
      title: item.title?.[lang] || item.title?.en || item.slug,
      summary: item.summary?.[lang] || item.summary?.en || label('reportSummary', bn ? 'প্রকাশিত প্রতিবেদন ও প্রাতিষ্ঠানিক তথ্য।' : 'An official publication from Srizony Foundation.'),
      url: item.attachment || '',
      date: item.date || '', category: 'reports', kind: 'report',
    }))
    return [...publishedReports, ...officialDocuments]
  }, [essentials.documents, reports, lang, bn, label])

  const visibleResources = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return resources.filter((item) => {
      const inCategory = filter === 'all' || item.category === filter
      const matchesQuery = !query || `${item.title} ${item.summary} ${item.date}`.toLocaleLowerCase().includes(query)
      return inCategory && matchesQuery
    })
  }, [resources, filter, search])

  const labels: Record<ResourceFilter, string> = {
    all: label('filterAll', bn ? 'সব রিসোর্স' : 'All resources'),
    reports: label('filterReports', bn ? 'প্রতিবেদন' : 'Reports'),
    documents: label('filterDocuments', bn ? 'অফিসিয়াল ডকুমেন্ট' : 'Official documents'),
  }

  return (
    <section className="sf-block sf-resource-directory" aria-live="polite" aria-busy={loading}>
      <header className="sf-resource-intro">
        <div>
          <p className="sf-eyebrow">{label('eyebrow', bn ? 'প্রকাশনা ও তথ্যভান্ডার' : 'PUBLICATIONS & INFORMATION')}</p>
          <h2>{page?.title?.[lang] || label('heading', bn ? 'রিসোর্স ও হালনাগাদ' : 'Resources and updates')}</h2>
          <p>{page?.subtitle?.[lang] || label('intro', bn ? 'বার্ষিক প্রতিবেদন, প্রাতিষ্ঠানিক নথি ও প্রকাশিত তথ্য এক জায়গায় খুঁজুন।' : 'Browse annual reports, official documents and published information from Srizony Foundation.')}</p>
        </div>
        <span className="sf-resource-count"><strong>{resources.length}</strong><small>{label('availableItems', bn ? 'টি রিসোর্স' : 'available items')}</small></span>
      </header>

      <div className="sf-resource-toolbar" role="search">
        <label className="sf-resource-search">
          <Search size={17} aria-hidden="true" />
          <span className="sf-sr-only">{label('searchLabel', bn ? 'রিসোর্স খুঁজুন' : 'Search resources')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={label('searchPlaceholder', bn ? 'প্রতিবেদন বা ডকুমেন্ট খুঁজুন' : 'Search reports and documents')}
          />
        </label>
        <div className="sf-resource-filters" role="group" aria-label={label('filterLabel', bn ? 'রিসোর্স ফিল্টার' : 'Filter resources')}>
          {(Object.keys(labels) as ResourceFilter[]).map((key) => (
            <button
              key={key}
              className={`sf-resource-filter ${filter === key ? 'is-active' : ''}`}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="sf-essentials-empty" role="status">{label('loading', bn ? 'ডকুমেন্ট লোড হচ্ছে…' : 'Loading documents…')}</div>
      ) : failed && reports.length === 0 ? (
        <div className="sf-essentials-empty" role="alert">
          <FileText size={26} aria-hidden="true" />
          <h2>{label('loadErrorTitle', bn ? 'ডকুমেন্ট লোড করা যায়নি' : 'Documents could not be loaded')}</h2>
          <p>{label('loadErrorMessage', bn ? 'অনুগ্রহ করে পরে আবার চেষ্টা করুন।' : 'Please refresh the page and try again.')}</p>
        </div>
      ) : visibleResources.length ? (
        <div className="sf-resource-grid">
          {visibleResources.map((resource) => {
            const Icon = resource.kind === 'staff' ? Users : resource.kind === 'location' ? MapPin : FileArchive
            return (
              <article className="sf-card sf-resource-card" key={resource.key}>
                <span className={`sf-resource-icon sf-resource-icon--${resource.kind}`}><Icon size={22} aria-hidden="true" /></span>
                <div className="sf-resource-content">
                  <div className="sf-resource-meta">
                    <span>{resource.category === 'reports' ? label('publication', bn ? 'প্রকাশনা' : 'PUBLICATION') : label('officialDocument', bn ? 'অফিসিয়াল ডকুমেন্ট' : 'OFFICIAL DOCUMENT')}</span>
                    {resource.date && <time dateTime={resource.date}>{formatDate(resource.date, lang)}</time>}
                  </div>
                  <h3>{resource.title || label('publicationTitle', bn ? 'প্রকাশনা' : 'Publication')}</h3>
                  <p>{resource.summary}</p>
                  {resource.url ? (
                    <a className="sf-resource-download" href={resource.url} target="_blank" rel="noopener noreferrer">
                      <ArrowDownToLine size={16} aria-hidden="true" />{label('download', bn ? 'PDF ডাউনলোড করুন' : 'Download document')}<ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="sf-resource-pending">{label('pending', bn ? 'ডকুমেন্ট শিগগির প্রকাশ করা হবে' : 'Document has not been published yet')}</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="sf-resource-empty">
          <FileText size={27} aria-hidden="true" />
          <h3>{label('noResultsTitle', bn ? 'কোনো রিসোর্স পাওয়া যায়নি' : 'No matching resources found')}</h3>
          <p>{label('noResultsMessage', bn ? 'অন্য শব্দ দিয়ে খুঁজুন অথবা সব রিসোর্স দেখুন।' : 'Try another search term or clear the selected filter.')}</p>
          {(search || filter !== 'all') && <button className="sf-btn sf-btn--secondary" type="button" onClick={() => { setSearch(''); setFilter('all') }}>{label('clearFilters', bn ? 'ফিল্টার মুছুন' : 'Clear filters')}</button>}
        </div>
      )}

      <div className="sf-resource-staff-link">
        <div><Users size={20} aria-hidden="true" /><span><strong>{label('staffLinkTitle', bn ? 'ব্যবস্থাপনা দলের পরিচিতি' : 'Meet the management team')}</strong><small>{label('staffLinkDescription', bn ? 'সৃজনী ফাউন্ডেশনের ব্যবস্থাপনা কর্মকর্তাদের প্রোফাইল দেখুন।' : 'View leadership and management profiles.')}</small></span></div>
        <Link href={bn ? '/bn/management-staff' : '/management-staff'}>{label('viewProfiles', bn ? 'প্রোফাইল দেখুন' : 'View profiles')} <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  )
}
