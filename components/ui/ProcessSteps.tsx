import type { ReactNode } from 'react'

type ProcessStep = {
  title: string
  description?: string
  meta?: string
  details?: string[]
  content?: ReactNode
}

/** Accessible, responsive step sequence shared by CMS journeys and guided workflows. */
export default function ProcessSteps({
  steps,
  ariaLabel,
  className = '',
}: {
  steps: ProcessStep[]
  ariaLabel: string
  className?: string
}) {
  if (!steps.length) return null
  return (
    <ol className={`sf-process-steps ${className}`.trim()} aria-label={ariaLabel}>
      {steps.map((step, index) => (
        <li className="sf-process-step" key={`${step.title}-${index}`}>
          <div className="sf-process-step-marker" aria-hidden="true">
            <span>{index + 1}</span>
          </div>
          <div className="sf-process-step-content">
            {step.meta && <span className="sf-process-step-meta">{step.meta}</span>}
            <h3>{step.title}</h3>
            {step.description && <p>{step.description}</p>}
            {step.details && step.details.length > 0 && <ul>{step.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
            {step.content}
          </div>
        </li>
      ))}
    </ol>
  )
}
