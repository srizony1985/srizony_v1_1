import type { ButtonHTMLAttributes, ReactNode } from 'react'
import AppLink, { type LinkAction } from '@/components/ui/AppLink'
import { cn } from '@/lib/utils'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
  children: ReactNode
  href?: string
  action?: LinkAction
  variant?: 'primary' | 'accent' | 'ghost' | 'outline' | 'outline-light'
  animated?: boolean
  className?: string
}

/** Shared action button: a real <button>, or a link (route / external / anchor) when `href` is set. */
export default function Button({ href, action, variant = 'primary', animated, className, children, type = 'button', ...rest }: ButtonProps) {
  const classes = cn('sf-btn', `sf-btn--${variant}`, animated && 'sf-btn--animated', className)
  if (href) return <AppLink href={href} action={action} className={classes} aria-label={rest['aria-label']}>{children}</AppLink>
  return <button type={type} className={classes} {...rest}>{children}</button>
}
