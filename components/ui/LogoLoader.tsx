'use client'

import Image from 'next/image'
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

export default function LogoLoader({
  label = 'Loading',
  fullScreen = false,
  size = 'md',
  inline = false,
  className = '',
}: Props) {
  const showLabel = Boolean(label) && size !== 'sm'
  const mark = size === 'sm' ? '22px' : size === 'lg' ? '120px' : '86px'

  const classes = [
    "sf-loader",
    inline ? "sf-loader-inline" : '',
    fullScreen ? "sf-loader-fullscreen" : '',
    `sf-loader-size-${size}`,
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
      role={decorative ? undefined : 'status'}
      aria-live={decorative ? undefined : 'polite'}
      aria-label={decorative ? undefined : label || 'Loading'}
      aria-hidden={decorative || undefined}
    >
      <span className={"sf-loader-mark"} aria-hidden="true">
        <span className={`${"sf-loader-ring"} ${"sf-loader-ring-one"}`} />
        {size !== 'sm' && <span className={`${"sf-loader-ring"} ${"sf-loader-ring-two"}`} />}
        <span className={"sf-loader-glow"} />
        <Image
          className={"sf-loader-logo"}
          src="/images/Logo-SF.png"
          alt=""
          width={144}
          height={144}
          sizes={mark}
          priority={!inline}
          loading="eager"
        />
      </span>

      {showLabel && (
        <span className={"sf-loader-label"} aria-hidden="true">
          {label}
          <span className={"sf-loader-dots"}>
            <i />
            <i />
            <i />
          </span>
        </span>
      )}
    </span>
  )
}