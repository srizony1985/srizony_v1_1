'use client'

import type { PageData, PageSection as ManagedPageSection, Section } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import ConfiguredLink from '@/components/ui/ConfiguredLink'
import SectionContent from '@/components/pages/SectionContent'

/** Renders a section with its CMS-managed visibility and optional buttons. */
export default function PageSection({ section, page }: { section: Section; page?: PageData }) {
  const { lang } = useSite()
  const managed = section as ManagedPageSection
  if (managed.visible === false) return null

  const button = managed.buttonConfig
  const showPrimary = Boolean(button?.visible && (button.mode === 'primary' || button.mode === 'both'))
  const showSecondary = Boolean(button?.visible && (button.mode === 'secondary' || button.mode === 'both'))
  const hasButtons = section.type !== 'cta' && button?.visible && (showPrimary || showSecondary)

  return (
    <>
      <SectionContent section={section} page={page} />
      {hasButtons && (
        <section className="sf-block sf-section-button-row">
          <div className="sf-cta-actions">
            {showPrimary && button?.label && button.href && (
              <ConfiguredLink href={button.href} action={button.action} className="sf-btn sf-btn--primary">
                {button.label[lang]}
              </ConfiguredLink>
            )}
            {showSecondary && button?.secondaryLabel && button.secondaryHref && (
              <ConfiguredLink href={button.secondaryHref} action={button.secondaryAction} className="sf-btn sf-btn--outline">
                {button.secondaryLabel[lang]}
              </ConfiguredLink>
            )}
          </div>
        </section>
      )}
    </>
  )
}
