import { plainSectionTitle } from '@/lib/sectionTitle'

/** Shared accessible heading for diagram variants. */
export default function DiagramHeading({ eyebrow, title, body }: { eyebrow: string; title?: string; body?: string }) {
  const cleanEyebrow = plainSectionTitle(eyebrow)
  const cleanTitle = plainSectionTitle(title)
  return (
    <header className="sf-diagram-head">
      {cleanEyebrow ? <span className="sf-diagram-eyebrow">{cleanEyebrow}</span> : null}
      {cleanTitle ? <h2>{cleanTitle}</h2> : null}
      {body ? <p>{body}</p> : null}
    </header>
  )
}
