import type { PageData, Section } from '@/types/entityType'
import PageSection from '@/components/pages/PageSection'
import LandingSectionRenderer, { isLandingComponentKey } from '@/components/home/LandingSectionRenderer'

/** CMS-driven section list. Every section's UI lives in its own component file. */
export default function SectionRenderer({ sections, page }: { sections: Section[]; page?: PageData }) {
  return <>{sections.map((section, index) => {
    if (isLandingComponentKey((section as Section & { homeComponent?: unknown }).homeComponent) && page) {
      return <LandingSectionRenderer key={`landing-${index}`} section={section as PageData['sections'][number]} page={page} />
    }
    return <PageSection key={`${section.type}-${index}`} section={section} page={page} />
  })}</>
}
