'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import s from '@/app/css_extra/LogoLoader.module.css'

type Props = {
  /** Text under the logo. Empty string hides it. */
  label?: string
  /** Cover the whole viewport with a blurred overlay. */
  fullScreen?: boolean
  /** sm = 22px (buttons), md = 86px (sections), lg = 120px (page loads). */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Inline mode: renders as an inline-flex element with no min-height or
   * padding, so it can sit inside buttons, table cells or text.
   */
  inline?: boolean
  className?: string
}

const MARK: Record<NonNullable<Props['size']>, number> = { sm: 22, md: 86, lg: 120 }

export default function LogoLoader({
  label = 'Loading',
  fullScreen = false,
  size = 'md',
  inline = false,
  className = '',
}: Props) {
  const mark = MARK[size]
  const showLabel = Boolean(label) && size !== 'sm'

  const classes = [
    s.loader,
    inline ? s.inline : '',
    fullScreen ? s.fullscreen : '',
    s[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // An unlabeled inline spinner (e.g. in a button) is decorative: the button's
  // own text already announces the state.
  const decorative = inline && !label

  return (
    <span
      className={classes}
      style={{ ['--mark' as string]: `${mark}px` } as CSSProperties}
      role={decorative ? undefined : 'status'}
      aria-live={decorative ? undefined : 'polite'}
      aria-label={decorative ? undefined : label || 'Loading'}
      aria-hidden={decorative || undefined}
    >
      <span className={s.mark} aria-hidden="true">
        <span className={`${s.ring} ${s.ringOne}`} />
        {size !== 'sm' && <span className={`${s.ring} ${s.ringTwo}`} />}
        <span className={s.glow} />
        <Image
          className={s.logo}
          src="/images/Logo-SF.png"
          alt=""
          width={144}
          height={144}
          sizes={`${mark}px`}
          priority={!inline}
          loading="eager"
        />
      </span>

      {showLabel && (
        <span className={s.label} aria-hidden="true">
          {label}
          <span className={s.dots}>
            <i />
            <i />
            <i />
          </span>
        </span>
      )}
    </span>
  )
}