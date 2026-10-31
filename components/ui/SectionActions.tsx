import { ArrowRight } from 'lucide-react'
import Button from '@/components/ui/ActionButton'
import type { Lang, SectionButtonConfig } from '@/types/entityType'

/** CMS-managed primary/secondary buttons for any section. The secondary button falls back to the primary's label, link and action. */
export default function SectionActions({ config, lang, arrow = false, block = false, className = '' }: { config?: SectionButtonConfig; lang: Lang; arrow?: boolean; block?: boolean; className?: string }) {
  if (!config?.visible) return null
  const mode = config.mode
  const primary = mode !== 'secondary' && config.label?.[lang] && config.href ? { label: config.label[lang], href: config.href, action: config.action } : null
  const secondaryHref = config.secondaryHref ?? config.href
  const secondaryLabel = (config.secondaryLabel ?? config.label)?.[lang]
  const secondary = mode !== 'primary' && secondaryLabel && secondaryHref ? { label: secondaryLabel, href: secondaryHref, action: config.secondaryAction ?? config.action } : null
  if (!primary && !secondary) return null
  const icon = arrow && <ArrowRight size={16} aria-hidden="true" />
  const actions = <div className={`sf-cta-actions ${className}`.trim()}>
    {primary && <Button href={primary.href} action={primary.action}>{primary.label} {icon}</Button>}
    {secondary && <Button href={secondary.href} action={secondary.action} variant="outline">{secondary.label} {icon}</Button>}
  </div>
  return block ? <section className="sf-block sf-section-button-row">{actions}</section> : actions
}
