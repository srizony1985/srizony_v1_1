'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Download, FileText, MapPin, Users } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import { useWebsiteEssentials } from '@/components/hooks/useWebsiteEssentials'

export default function ResourcesContent() {
  const { lang } = useSite()
  const { essentials, loading, failed } = useWebsiteEssentials()

  const bn = lang === 'bn'
  const docs = useMemo(() => [
    {
      key: 'staff',
      title: bn ? essentials.documents.staffListPdf.titleBn : essentials.documents.staffListPdf.titleEn,
      url: essentials.documents.staffListPdf.url,
      icon: Users,
      summary: bn ? 'অনুমোদিত কর্মকর্তা-কর্মচারীর তালিকা PDF ফাইলে।' : 'The approved staff list, available as a PDF document.',
    },
    {
      key: 'locations',
      title: bn ? essentials.documents.locationsPdf.titleBn : essentials.documents.locationsPdf.titleEn,
      url: essentials.documents.locationsPdf.url,
      icon: MapPin,
      summary: bn ? 'কার্যালয়, কার্যক্রমের স্থান ও শাখার তালিকা PDF ফাইলে।' : 'Head office, working locations and branch office directory in PDF format.',
    },
  ], [essentials.documents, bn])

  return (
    <section className="sf-block sf-resource-directory" aria-live="polite" aria-busy={loading}>
      {loading ? (
        <div className="sf-essentials-empty" role="status">{bn ? 'ডকুমেন্ট লোড হচ্ছে…' : 'Loading documents…'}</div>
      ) : failed ? (
        <div className="sf-essentials-empty" role="alert">
          <FileText size={26} aria-hidden="true" />
          <h2>{bn ? 'ডকুমেন্ট লোড করা যায়নি' : 'Documents could not be loaded'}</h2>
          <p>{bn ? 'অনুগ্রহ করে পরে আবার চেষ্টা করুন।' : 'Please refresh the page and try again.'}</p>
        </div>
      ) : (
        <div className="sf-resource-grid">
          {docs.map((doc) => {
            const Icon = doc.icon
            return (
              <article className="sf-card sf-resource-card" key={doc.key}>
                <span className="sf-resource-icon"><Icon size={23} aria-hidden="true" /></span>
                <div className="sf-resource-content">
                  <h2>{doc.title || (doc.key === 'staff' ? 'Staff List' : 'Working Locations')}</h2>
                  <p>{doc.summary}</p>
                  {doc.url ? (
                    <a className="sf-resource-download" href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Download size={16} aria-hidden="true" />{bn ? 'PDF ডাউনলোড করুন' : 'Open / download PDF'}
                    </a>
                  ) : (
                    <span className="sf-resource-pending">{bn ? 'ডকুমেন্ট শিগগির প্রকাশ করা হবে' : 'Document has not been published yet'}</span>
                  )}
                </div>
              </article>
            )
          })}
          <article className="sf-card sf-resource-card">
            <span className="sf-resource-icon"><Users size={23} aria-hidden="true" /></span>
            <div className="sf-resource-content">
              <h2>{bn ? 'ব্যবস্থাপনা কর্মকর্তা' : 'Management Staff'}</h2>
              <p>{bn ? 'ওয়েবসাইটে প্রকাশিত ব্যবস্থাপনা দলের প্রোফাইল দেখুন।' : 'View the management staff directory published on the website.'}</p>
              <Link className="sf-resource-download" href={bn ? '/bn/management-staff' : '/management-staff'}>
                {bn ? 'কর্মকর্তাদের দেখুন' : 'View staff directory'} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
