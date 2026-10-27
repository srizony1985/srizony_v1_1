'use client'

import type { HeroSlide, PageData } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import Hero from '@/components/home/Hero'
import GrowthSection from '@/components/home/GrowthSection'
import MissionVisionValues from '@/components/home/MissionVisionValues'
import LocationMaps from '@/components/home/LocationMaps'
import DevelopmentAreas from '@/components/home/DevelopmentAreas'
import StoryRail from '@/components/home/StoryRail'
import DonateBanner from '@/components/home/DonateBanner'
import Container from '@/components/containers/Container'
import SectionRenderer from '@/components/pages/SectionRenderer'

/** Homepage components are selected by CMS section identity, so edits and ordering reach '/'. */
const normalizeHeading = (value?: string) => (value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
const headingOf = (section: PageData['sections'][number]) => ('heading' in section ? section.heading?.en : '') ?? ''
const matchesSection = (section: PageData['sections'][number], type: string, heading: string, homeComponent?: string) =>
  section.type === type && (section.homeComponent === homeComponent || normalizeHeading(headingOf(section)) === heading)



export default function HomePage({ page }: { page: PageData }) {
  const { lang, site } = useSite()
  if (!site) return null
  const homeHero = site.global.homeHero
  const homeHeroSection = page.sections.find((section) => matchesSection(section, 'carousel', 'landing page hero', 'hero')) as Extract<PageData['sections'][number], { type: 'carousel' }> | undefined
  const slidesOverride: HeroSlide[] | undefined = homeHeroSection?.visible === false ? [] : homeHeroSection?.items?.flatMap((item, index) => {
    const image = item.image?.src
    if (!image) return []
    return [{
      id: `cms-home-hero-${index + 1}`,
      image,
      title: item.title,
      alt: item.image?.alt ?? item.title,
      description: item.body ?? { en: '', bn: '' },
      href: item.href || homeHero?.slides?.[index]?.href || '/about-us',
    }]
  })

  return (
    <Container variant="page" className={`sf-home sf-home--layout-${page.layout ?? 'standard'}`}>
      {page.sections.map((section, index) => {
        if (section.visible === false) return null
        const heading = normalizeHeading(headingOf(section))
        const key = `${section.type}-${heading}-${index}`
        if (matchesSection(section, 'carousel', 'landing page hero', 'hero')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'carousel', 'landing page hero', 'hero'))
          return index === first && homeHero ? <Hero key={key} hero={homeHero} lang={lang} slidesOverride={slidesOverride} tone={page.heroTone} /> : null
        }
        if (matchesSection(section, 'stats', 'growing together', 'growth')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'stats', 'growing together', 'growth'))
          return index === first ? <GrowthSection key={key} lang={lang} page={page} /> : null
        }
        if (matchesSection(section, 'cards', 'mission, vision & values', 'missionVisionValues')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'cards', 'mission, vision & values', 'missionVisionValues'))
          return index === first ? <MissionVisionValues key={key} lang={lang} page={page} /> : null
        }
        if (matchesSection(section, 'richText', 'our offices across bangladesh', 'locations')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'richText', 'our offices across bangladesh', 'locations'))
          return index === first ? <LocationMaps key={key} page={page} /> : null
        }
        if (matchesSection(section, 'cards', 'integrated development areas', 'developmentAreas')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'cards', 'integrated development areas', 'developmentAreas'))
          return index === first ? <DevelopmentAreas key={key} lang={lang} page={page} /> : null
        }
        if (matchesSection(section, 'carousel', 'success story of srizony', 'stories')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'carousel', 'success story of srizony', 'stories'))
          return index === first ? <StoryRail key={key} page={page} lang={lang} /> : null
        }
        if (matchesSection(section, 'cta', 'support srizony', 'donate')) {
          const first = page.sections.findIndex((item) => matchesSection(item, 'cta', 'support srizony', 'donate'))
          const cta = section as Extract<PageData['sections'][number], { type: 'cta' }>
          return index === first ? <DonateBanner key={key} lang={lang} section={cta} /> : null
        }
        // All other section types (including legacy rich text, timeline, diagrams and cards)
        // use the generic renderer so Page Builder controls always affect the public homepage.
        return <SectionRenderer key={key} sections={[section]} page={page} />
      })}
    </Container>
  )
}
