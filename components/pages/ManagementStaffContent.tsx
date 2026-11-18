'use client'

import { useMemo, useState } from 'react'
import { Building2, ChevronDown, Search, Users } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import type { ManagementStaffMember } from '@/lib/websiteEssentials'
import type { PageData } from '@/types/entityType'
import { useWebsiteEssentials } from '@/components/hooks/useWebsiteEssentials'

function StaffProfile({ person, lang, ui }: { person: ManagementStaffMember; lang: 'en' | 'bn'; ui: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)
  const bn = lang === 'bn'
  const name = bn ? person.nameBn || person.nameEn : person.nameEn || person.nameBn
  const designation = bn ? person.designationBn || person.designationEn : person.designationEn || person.designationBn
  const bio = bn ? person.bioBn || person.bioEn || '' : person.bioEn || person.bioBn || ''
  const canExpand = bio.length > 310
  const visibleBio = expanded || !canExpand ? bio : `${bio.slice(0, 295).trimEnd()}…`

  return (
    <article className="sf-card sf-staff-card">
      <div className="sf-staff-photo">
        {person.photoUrl ? (
          // Website Essentials media URLs are administrator-managed public profile images.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt={name} loading="lazy" />
        ) : (
          <div aria-hidden="true" className="sf-staff-placeholder"><Users size={34} /></div>
        )}
      </div>
      <div className="sf-staff-info">
        <span className="sf-staff-role">{ui['staff.roleLabel'] || (bn ? 'ব্যবস্থাপনা দল' : 'MANAGEMENT TEAM')}</span>
        <h3>{name}</h3>
        {designation && <p className="sf-staff-designation">{designation}</p>}
        {bio && <p className="sf-staff-bio">{visibleBio}</p>}
        {canExpand && (
          <button className="sf-staff-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? (ui['staff.showLess'] || (bn ? 'সংক্ষিপ্ত দেখুন' : 'Show less')) : (ui['staff.readProfile'] || (bn ? 'সম্পূর্ণ পরিচিতি' : 'Read full profile'))}
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  )
}

export default function ManagementStaffContent({ page }: { page?: Pick<PageData, 'title' | 'subtitle'> }) {
  const { lang, site } = useSite()
  const { essentials, loading, failed } = useWebsiteEssentials()
  const [search, setSearch] = useState('')
  const bn = lang === 'bn'
  const ui = site?.global.ui?.[lang] ?? {}
  const label = (key: string, fallback: string) => ui[`staff.${key}`] || fallback
  const staff = useMemo(() => essentials.staff
    .filter((person: ManagementStaffMember) => person.published && (person.nameEn.trim() || person.nameBn.trim()))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn)), [essentials.staff])
  const filteredStaff = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return staff
    return staff.filter((person) => [person.nameEn, person.nameBn, person.designationEn, person.designationBn, person.bioEn, person.bioBn]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query)))
  }, [staff, search])

  return (
    <section className="sf-block sf-staff-directory" aria-live="polite" aria-busy={loading}>
      <header className="sf-staff-intro">
        <div>
          <p className="sf-eyebrow">{label('eyebrow', bn ? 'নেতৃত্ব ও ব্যবস্থাপনা' : 'LEADERSHIP & MANAGEMENT')}</p>
          <h2>{page?.title?.[lang] || label('heading', bn ? 'আমাদের ব্যবস্থাপনা দল' : 'Meet our management team')}</h2>
          <p>{page?.subtitle?.[lang] || label('intro', bn ? 'সৃজনী ফাউন্ডেশনের কার্যক্রম পরিচালনা ও বাস্তবায়নে দায়িত্বপ্রাপ্ত ব্যক্তিদের পরিচিতি।' : 'Get to know the people responsible for guiding and supporting the work of Srizony Foundation.')}</p>
        </div>
        <span className="sf-staff-count"><strong>{staff.length}</strong><small>{label('publishedProfiles', bn ? 'প্রকাশিত প্রোফাইল' : 'published profiles')}</small></span>
      </header>

      <label className="sf-staff-search">
        <Search size={17} aria-hidden="true" />
        <span className="sf-sr-only">{label('searchLabel', bn ? 'নাম, পদবি বা পরিচিতি দিয়ে খুঁজুন' : 'Search by name, designation or profile')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={label('searchPlaceholder', bn ? 'নাম, পদবি বা পরিচিতি দিয়ে খুঁজুন' : 'Search name, designation or profile')}
        />
        {search && <button type="button" onClick={() => setSearch('')} aria-label={label('clearSearch', bn ? 'অনুসন্ধান মুছুন' : 'Clear search')}>×</button>}
      </label>

      {loading ? (
        <div className="sf-essentials-empty" role="status">{label('loading', bn ? 'তথ্য লোড হচ্ছে…' : 'Loading staff directory…')}</div>
      ) : failed ? (
        <div className="sf-essentials-empty" role="alert">
          <Building2 size={26} aria-hidden="true" />
          <h2>{label('loadErrorTitle', bn ? 'তথ্য লোড করা যায়নি' : 'Staff information could not be loaded')}</h2>
          <p>{label('loadErrorMessage', bn ? 'অনুগ্রহ করে পরে আবার চেষ্টা করুন।' : 'Please refresh the page and try again.')}</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="sf-essentials-empty">
          <Building2 size={26} aria-hidden="true" />
          <h2>{label('emptyTitle', bn ? 'ব্যবস্থাপনা কর্মকর্তাদের তথ্য শিগগির প্রকাশ করা হবে' : 'Management staff information will be published soon')}</h2>
          <p>{label('emptyMessage', bn ? 'অনুমোদিত তথ্য যুক্ত হলে এই তালিকা হালনাগাদ হবে।' : 'This directory will be updated when approved staff records are added by the website administrator.')}</p>
        </div>
      ) : filteredStaff.length ? (
        <div className="sf-staff-list">
          {filteredStaff.map((person) => <StaffProfile key={person.id} person={person} lang={lang} ui={ui} />)}
        </div>
      ) : (
        <div className="sf-resource-empty">
          <Users size={26} aria-hidden="true" />
          <h3>{label('noResultsTitle', bn ? 'কোনো প্রোফাইল পাওয়া যায়নি' : 'No matching profiles found')}</h3>
          <p>{label('noResultsMessage', bn ? 'অন্য শব্দ দিয়ে খুঁজুন।' : 'Try a different name or designation.')}</p>
          <button className="sf-btn sf-btn--secondary" type="button" onClick={() => setSearch('')}>{label('clearSearch', bn ? 'অনুসন্ধান মুছুন' : 'Clear search')}</button>
        </div>
      )}
    </section>
  )
}
