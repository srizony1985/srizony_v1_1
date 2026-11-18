'use client'

import type { CSSProperties } from 'react'
import type { PageData, PageSection as ManagedPageSection, Section } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import SectionActions from '@/components/ui/SectionActions'
import SectionContent from '@/components/pages/SectionContent'
import { toCmsTypographyStyle } from '@/lib/cms/typography'

/** Renders a section with its CMS-managed visibility and optional buttons. */
export default function PageSection({ section, page }: { section: Section; page?: PageData }) {
  const { lang } = useSite()
  const managed = section as ManagedPageSection
  if (managed.visible === false) return null
  return (
    <div className="cms-typography-scope" style={toCmsTypographyStyle(managed.typography) as CSSProperties}>
      <SectionContent section={section} page={page} />
      {section.type !== 'cta' && <SectionActions config={managed.buttonConfig} lang={lang} block />}
    </div>
  )
}
