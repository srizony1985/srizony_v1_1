'use client'

import type { PageData } from '@/types/entityType'
import Container from '@/components/containers/Container'
import SectionRenderer from '@/components/pages/SectionRenderer'

/**
 * Homepage composition remains specialised where a section declares a
 * homeComponent, but normal Page Builder sections are also first-class content.
 */
export default function HomePage({ page }: { page: PageData }) {
  const visibleSections = page.sections.filter((section) => section.visible !== false)
  return (
    <Container variant="home" className={`sf-home sf-home--layout-${page.layout ?? 'wide'}`}>
      <SectionRenderer sections={visibleSections} page={page} />
    </Container>
  )
}
