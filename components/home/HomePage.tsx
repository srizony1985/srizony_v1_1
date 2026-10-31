'use client'

import type { PageData } from '@/types/entityType'
import Container from '@/components/containers/Container'
import LandingSectionRenderer from '@/components/home/LandingSectionRenderer'
import { isLandingComponentKey } from '@/components/home/LandingSectionRenderer'

/**
 * Home is an intentionally separate presentation layer: only registered landing
 * compositions can render here. Page-only sections are rejected, even if their
 * underlying section type is otherwise valid on a normal slug page.
 */
export default function HomePage({ page }: { page: PageData }) {
  return (
    <Container variant="page" className={`sf-home sf-home--layout-${page.layout ?? 'standard'}`}>
      {page.sections.map((section, index) => {
        if (section.visible === false || !isLandingComponentKey(section.homeComponent)) return null
        return <LandingSectionRenderer key={`${section.homeComponent}-${index}`} page={page} section={section} />
      })}
    </Container>
  )
}
