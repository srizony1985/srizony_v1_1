'use client'

import Link from 'next/link'
import type { Lang, PageData } from '@/types/entityType'
import Container from '@/components/containers/Container'
import Reveal from '@/components/containers/Reveal'
import SafeImage from '@/components/ui/SafeImage'
import ConfiguredLink from '@/components/ui/ConfiguredLink'

type CarouselSection = Extract<PageData['sections'][number], { type: 'carousel' }>

/** Editorial, image-first Success Stories gallery reserved for registered landing compositions. */
export default function SuccessStoriesGallery({ page, lang }: { page: PageData; lang: Lang }) {
  const source = page.sections.find((section): section is CarouselSection =>
    section.type === 'carousel' && section.homeComponent === 'successStories' && section.collectionKind === 'success-stories',
  )
  if (!source || source.visible === false) return null

  // Published Success Story records are injected by the server data gateway.
  // Only image-backed records are suitable for this image-first gallery.
  const maxItems = Math.max(2, Math.min(12, Number(source.maxItems ?? 8) || 8))
  const items = (Array.isArray(source.items) ? source.items : []).filter((item) => Boolean(
    item.image?.src && item.title?.[lang]?.trim() && item.href?.startsWith('/success-stories/'),
  )).slice(0, maxItems)

  const button = source.buttonConfig
  const showAll = button?.visible !== false && (button?.mode === 'primary' || button?.mode === 'both')
  const buttonLabel = button?.label?.[lang] || (lang === 'en' ? 'Explore all success stories' : 'সব সাফল্যের গল্প দেখুন')

  return (
    <section className="sf-section sf-success-gallery" aria-labelledby="sf-success-gallery-title">
      <Container>
        <Reveal>
          <header className="sf-sec-head sf-sec-head--center sf-success-gallery-head">
            {source.eyebrow?.[lang] && <span className="sf-eyebrow">{source.eyebrow[lang]}</span>}
            <h2 id="sf-success-gallery-title" className="sf-h2">{source.heading?.[lang] || (lang === 'en' ? 'Success Stories of Srizony' : 'সৃজনীর সাফল্যের গল্পসমূহ')}</h2>
            {source.body?.[lang] && <p className="sf-lead">{source.body[lang]}</p>}
          </header>
        </Reveal>
        {items.length > 0 ? <div className="sf-success-gallery-grid">
          {items.map((item, index) => {
            const href = item.href!
            const title = item.title[lang]
            const alt = item.image?.alt?.[lang] || title
            return (
              <Reveal key={`${href}-${index}`}>
                <Link href={href} className="sf-success-gallery-card" aria-label={title}>
                  <SafeImage
                    src={item.image!.src}
                    alt={alt}
                    fill
                    sizes="(max-width: 640px) 92vw, (max-width: 1000px) 46vw, 33vw"
                    className="sf-success-gallery-image"
                  />
                  <span className="sf-success-gallery-shade" aria-hidden="true" />
                  <span className="sf-success-gallery-frame" aria-hidden="true" />
                  <span className="sf-success-gallery-title">{title}</span>
                </Link>
              </Reveal>
            )
          })}
        </div> : <div className="sf-success-gallery-empty" role="status">
          {lang === 'en' ? 'New success stories will appear here as soon as they are published.' : 'নতুন সাফল্যের গল্প প্রকাশিত হলে এখানে দেখা যাবে।'}
        </div>}
        {showAll && <div className="sf-success-gallery-actions">
          <ConfiguredLink href="/success-stories" action="route" className="sf-btn sf-btn--ghost">
            {buttonLabel}
          </ConfiguredLink>
        </div>}
      </Container>
    </section>
  )
}
