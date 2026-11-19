import type { ExternalValue } from '@/types/json'
import type { PageData, Section } from '@/types/entityType'
import PageSection from '@/components/pages/PageSection'
import LandingSectionRenderer, { isLandingComponentKey } from '@/components/home/LandingSectionRenderer'
import { LANDING_COMPONENT_TYPE } from '@/lib/cms/component-policy'
import { toCmsTypographyStyle } from '@/lib/cms/typography'
import type { CSSProperties } from 'react'

/** CMS-driven section list. Every section's UI lives in its own component file. */
export default function SectionRenderer({ sections, page }: { sections: Section[]; page?: PageData }) {
  return <>{sections.map((section, index) => {
    const homeComponent = (section as Section & { homeComponent?: ExternalValue }).homeComponent
    if (page && isLandingComponentKey(homeComponent) && LANDING_COMPONENT_TYPE[homeComponent] === section.type) {
      return <div key={`landing-${index}`} className="cms-typography-scope" style={toCmsTypographyStyle((section as PageData['sections'][number]).typography) as CSSProperties}><LandingSectionRenderer section={section as PageData['sections'][number]} page={page} /></div>
    }
    // A stale legacy homeComponent must not make an otherwise valid CMS section
    // disappear. Render it with its ordinary section component until the editor
    // normalizes or removes the obsolete composition marker.
    return <PageSection key={`${section.type}-${index}`} section={section} page={page} />
  })}</>
}
