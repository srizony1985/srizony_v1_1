import type { ReactNode } from 'react'

type ContainerProps = {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
  id?: string
  variant?: 'content' | 'page'
}

/** Shared responsive width and horizontal gutter for public pages. */
export default function Container({ children, className = '', as = 'div', id, variant = 'content' }: ContainerProps) {
  const Component = as
  const baseClass = variant === 'page' ? 'sf-container sf-page-container' : 'sf-container'
  return <Component id={id} className={`${baseClass} ${className}`.trim()}>{children}</Component>
}
