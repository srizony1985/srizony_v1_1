import type { CSSProperties } from 'react'
import type { Lang } from '@/types/entityType'
import type { LucideIcon } from 'lucide-react'
import { localizeDigits } from '@/lib/utils'
export type Sdg = { n: string; icon: LucideIcon; tone: string; label: Record<Lang, string>; text: Record<Lang, string> }

/** Card for one Sustainable Development Goal in an impact diagram. */
export default function SdgCard({ item, lang }: { item: Sdg; lang: Lang }) {
  const Icon = item.icon
  return (
    <article className="sf-diagram-sdg-card" style={{ '--sf-card-tone': item.tone } as CSSProperties}>
      <div className="sf-diagram-sdg-icon"><Icon size={26} /></div>
      <div className="sf-diagram-sdg-number">{localizeDigits(item.n, lang)}</div>
      <h3>{item.label[lang]}</h3>
      <p>{item.text[lang]}</p>
    </article>
  )
}
