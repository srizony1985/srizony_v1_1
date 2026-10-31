'use client'

import type { PageData, PageSection as ManagedPageSection, Section } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import SectionActions from '@/components/ui/SectionActions'
import SectionContent from '@/components/pages/SectionContent'

/** Renders a section with its CMS-managed visibility and optional buttons. */
export default function PageSection({ section, page }: { section: Section; page?: PageData }) {
  const { lang } = useSite()
  const managed = section as ManagedPageSection
  if (managed.visible === false) return null
  return (
    <>
      <SectionContent section={section} page={page} />
      {section.type !== 'cta' && <SectionActions config={managed.buttonConfig} lang={lang} block />}
    </>
  )
}
