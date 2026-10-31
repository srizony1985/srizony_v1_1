'use client'

import { useMemo } from 'react'
import { Building2, Users } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import type { ManagementStaffMember } from '@/lib/websiteEssentials'
import { useWebsiteEssentials } from '@/components/hooks/useWebsiteEssentials'

export default function ManagementStaffContent() {
  const { lang } = useSite()
  const { essentials, loading, failed } = useWebsiteEssentials()

  const bn = lang === 'bn'
  const staff = useMemo(() => essentials.staff
    .filter((person: ManagementStaffMember) => person.published && (person.nameEn.trim() || person.nameBn.trim()))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn)), [essentials.staff])

  return (
    <section className="sf-block sf-staff-directory" aria-live="polite" aria-busy={loading}>
      {loading ? (
        <div className="sf-essentials-empty" role="status">{bn ? 'তথ্য লোড হচ্ছে…' : 'Loading staff directory…'}</div>
      ) : failed ? (
        <div className="sf-essentials-empty" role="alert">
          <Building2 size={26} aria-hidden="true" />
          <h2>{bn ? 'তথ্য লোড করা যায়নি' : 'Staff information could not be loaded'}</h2>
          <p>{bn ? 'অনুগ্রহ করে পরে আবার চেষ্টা করুন।' : 'Please refresh the page and try again.'}</p>
        </div>
      ) : staff.length ? (
        <div className="sf-staff-grid">
          {staff.map((person) => (
            <article className="sf-card sf-staff-card" key={person.id}>
              <div className="sf-staff-photo">
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt={bn ? person.nameBn || person.nameEn : person.nameEn || person.nameBn} loading="lazy" />
                ) : (
                  <div aria-hidden="true" className="sf-staff-placeholder"><Users size={32} /></div>
                )}
              </div>
              <div className="sf-staff-info">
                <h2>{bn ? person.nameBn || person.nameEn : person.nameEn || person.nameBn}</h2>
                {(bn ? person.designationBn || person.designationEn : person.designationEn || person.designationBn) && (
                  <p className="sf-staff-designation">{bn ? person.designationBn || person.designationEn : person.designationEn || person.designationBn}</p>
                )}
                {(bn ? person.bioBn : person.bioEn) && <p className="sf-staff-bio">{bn ? person.bioBn : person.bioEn}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="sf-essentials-empty">
          <Building2 size={26} aria-hidden="true" />
          <h2>{bn ? 'ব্যবস্থাপনা কর্মকর্তাদের তথ্য শিগগির প্রকাশ করা হবে' : 'Management staff information will be published soon'}</h2>
          <p>{bn ? 'অনুমোদিত তথ্য যুক্ত হলে এই তালিকা হালনাগাদ হবে।' : 'This directory will be updated when approved staff records are added by the website administrator.'}</p>
        </div>
      )}
    </section>
  )
}
