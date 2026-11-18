import type { CSSProperties, SelectHTMLAttributes } from 'react'
import { NativeSelect } from './native-select'

export type SelectOptionDisplay = 'dropdown' | 'listbox'

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  /** CSS width, for example '100%', '18rem', or 320. */
  width?: CSSProperties['width']
  /** CSS height. In listbox mode this controls the visible options area height. */
  height?: CSSProperties['height']
  /** Displays a standard native dropdown or an always-visible options list. */
  optionDisplay?: SelectOptionDisplay
  /** Number of visible rows in listbox mode. Defaults to 5. */
  visibleOptions?: number
}

function normalizeVisibleOptions(value: number | undefined): number {
  if (!Number.isFinite(value)) return 5
  return Math.min(30, Math.max(2, Math.floor(value as number)))
}

/**
 * A real HTML select element with optional dimensions and listbox presentation.
 * Width, height and the native `size` attribute are applied directly to the
 * actual <select>. Visuals live in select.css (dropdown + listbox views).
 */
export function Select({
  width,
  height,
  style,
  className,
  optionDisplay = 'dropdown',
  visibleOptions = 5,
  children,
  ...props
}: SelectProps) {
  const rows = normalizeVisibleOptions(visibleOptions)
  const isListbox = optionDisplay === 'listbox'

  const selectStyle: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined
      ? { height }
      : isListbox
        ? { height: `calc(${rows} * var(--sel-row, 36px) + 12px)` }
        : {}),
  }

  return (
    <select
      {...props}
      size={isListbox ? rows : undefined}
      data-display={optionDisplay}
      className={`ui-select${className ? ` ${className}` : ''}`}
      style={selectStyle}
    >
      {children}
    </select>
  )
}

// Keep the old native-control export available for existing imports.
export { NativeSelect }
export default Select