'use client'

import type { PageData, PageSection } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import Hero from '@/components/home/Hero'
import GrowthSection from '@/components/home/GrowthSection'
import MissionVisionValues from '@/components/home/MissionVisionValues'
import LocationMaps from '@/components/home/LocationMaps'
import DevelopmentAreas from '@/components/home/DevelopmentAreas'
import NewsRail from '@/components/home/NewsRail'
import SuccessStoriesGallery from '@/components/home/SuccessStoriesGallery'
import DonateBanner from '@/components/home/DonateBanner'
export { LANDING_COMPONENT_KEYS, isLandingComponentKey } from '@/lib/cms/component-policy'


export default function LandingSectionRenderer({ section, page }: { section: PageSection; page: PageData }) {
  const { lang, site } = useSite()
  const scopedPage = { ...page, sections: [section] }

  switch (section.homeComponent) {
    case 'hero': {
      if (section.type !== 'carousel' || !site?.global.homeHero || section.visible === false) return null
      const slidesOverride = section.items.flatMap((item, index) => item.image?.src ? [{
        id: `cms-landing-slide-${index + 1}`,
        image: item.image.src,
        title: item.title,
        alt: item.image.alt ?? item.title,
        description: item.body ?? { en: '', bn: '' },
        href: item.href || '/about-us',
      }] : [])
      return <Hero hero={site.global.homeHero} lang={lang} slidesOverride={slidesOverride} tone={page.heroTone} />
    }
    case 'growth': return section.type === 'stats' ? <GrowthSection lang={lang} page={scopedPage} /> : null
    case 'missionVisionValues': return section.type === 'cards' ? <MissionVisionValues lang={lang} page={scopedPage} /> : null
    case 'locations': return section.type === 'richText' ? <LocationMaps page={scopedPage} /> : null
    case 'developmentAreas': return section.type === 'cards' ? <DevelopmentAreas lang={lang} page={scopedPage} /> : null
    case 'news':
    case 'stories':
    case 'newsFeed': return section.type === 'carousel' ? <NewsRail page={scopedPage} lang={lang} /> : null
    case 'successStories': return section.type === 'carousel' ? <SuccessStoriesGallery page={scopedPage} lang={lang} /> : null
    case 'donate': return section.type === 'cta' ? <DonateBanner lang={lang} section={section} /> : null
    default: return null
  }
}
