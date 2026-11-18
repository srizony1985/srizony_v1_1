import type { CSSProperties } from 'react'

/** React style object supporting typed CSS custom properties. */
export type CSSVariableProperties = CSSProperties & {
  [property: `--${string}`]: string | number | undefined
}
