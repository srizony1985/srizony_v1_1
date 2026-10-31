'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { buildThemeCssVariables, type RuntimeShapeName, type RuntimeThemeMap } from '@/lib/themeRuntime'

type ThemeVars = Record<string, string>

function hexToTriplet(value: string | undefined, fallback = '255 255 255') {
  if (!value) return fallback
  const hex = value.trim().replace(/^#/, '')
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback
  return [0, 2, 4]
    .map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16))
    .join(' ')
}

function buildAdminCssVariables(themeVars: ThemeVars) {
  const background = hexToTriplet(themeVars['--sf-bg'], '248 250 252')
  const surface = hexToTriplet(themeVars['--sf-card'], '255 255 255')
  const surfaceMuted = hexToTriplet(themeVars['--sf-soft'], '241 245 249')
  const surfaceRaised = hexToTriplet(themeVars['--sf-raised'], '255 255 255')
  const border = hexToTriplet(themeVars['--sf-border'], '203 213 225')
  const borderStrong = hexToTriplet(themeVars['--sf-border-strong'] || themeVars['--sf-border'], '148 163 184')
  const textPrimary = hexToTriplet(themeVars['--sf-ink'], '15 23 42')
  const textMuted = hexToTriplet(themeVars['--sf-muted'], '100 116 139')
  const primary = hexToTriplet(themeVars['--sf-primary'], '185 28 28')
  const primaryForeground = hexToTriplet(themeVars['--sf-on-primary'], '255 255 255')
  const secondary = hexToTriplet(themeVars['--sf-secondary'], '229 106 63')
  const accent = hexToTriplet(themeVars['--sf-accent'], '244 201 75')
  const success = hexToTriplet(themeVars['--sf-success'], '5 150 105')
  const warning = hexToTriplet(themeVars['--sf-warning'], '217 119 6')
  const danger = hexToTriplet(themeVars['--sf-danger'], '185 28 28')
  const focus = hexToTriplet(themeVars['--sf-focus'], '37 99 235')
  const radius = themeVars['--sf-radius-shape'] || '10px'
  // Mirror the shared public SF radius scale so every CMS page responds to the
  // same theme shape setting instead of using a single fixed radius everywhere.
  const radiusControl = `min(12px, ${radius})`
  const radiusSmall = `min(8px, calc(${radius} * .7))`
  const radiusPanel = `min(22px, calc(${radius} + 4px))`

  const primaryHover = themeVars['--sf-primary-strong'] || `rgb(${primary})`
  const primaryActive = `color-mix(in srgb, rgb(${primary}) 76%, rgb(${primaryForeground}))`
  const fontBody = themeVars['--sf-font-body'] || 'ui-sans-serif, system-ui, sans-serif'
  const fontDisplay = themeVars['--sf-font-display'] || 'ui-sans-serif, system-ui, sans-serif'
  const tracking = themeVars['--sf-tracking'] || '-.02em'

  return {
    '--background-rgb': background,
    '--surface-rgb': surface,
    '--surface-muted-rgb': surfaceMuted,
    '--surface-raised-rgb': surfaceRaised,
    '--border-rgb': border,
    '--border-strong-rgb': borderStrong,
    '--text-primary-rgb': textPrimary,
    '--text-secondary-rgb': textPrimary,
    '--text-muted-rgb': textMuted,
    '--overlay-rgb': textPrimary,

    '--success-rgb': success,
    '--success-soft-rgb': surfaceMuted,
    '--success-border-rgb': border,
    '--success-text-rgb': success,
    '--warning-rgb': warning,
    '--warning-soft-rgb': surfaceMuted,
    '--warning-border-rgb': border,
    '--warning-text-rgb': warning,
    '--danger-rgb': danger,
    '--danger-soft-rgb': surfaceMuted,
    '--danger-border-rgb': border,
    '--danger-text-rgb': danger,
    '--info-rgb': focus,
    '--info-soft-rgb': surfaceMuted,
    '--info-border-rgb': border,
    '--info-text-rgb': focus,

    '--primary-rgb': primary,
    '--primary-hover-rgb': primary,
    '--primary-active-rgb': primary,
    '--primary-fg-rgb': primaryForeground,
    '--secondary-rgb': secondary,
    '--accent-rgb': accent,

    '--background': `rgb(${background})`,
    '--surface': `rgb(${surface})`,
    '--surface-muted': `rgb(${surfaceMuted})`,
    '--surface-raised': `rgb(${surfaceRaised})`,
    '--border': `rgb(${border})`,
    '--border-strong': `rgb(${borderStrong})`,
    '--text-primary': `rgb(${textPrimary})`,
    '--text-secondary': `rgb(${textPrimary})`,
    '--text-muted': `rgb(${textMuted})`,
    '--primary': `rgb(${primary})`,
    '--primary-foreground': `rgb(${primaryForeground})`,
    '--primary-hover': primaryHover,
    '--primary-active': primaryActive,
    '--secondary': `rgb(${secondary})`,
    '--accent': `rgb(${accent})`,
    '--tracking': tracking,
    '--font-body': fontBody,
    '--font-display': fontDisplay,
    '--primary-light': `color-mix(in srgb, rgb(${primary}) 9%, rgb(${surface}))`,
    '--primary-soft': `color-mix(in srgb, rgb(${primary}) 16%, rgb(${surface}))`,
    '--primary-gradient': `linear-gradient(135deg, rgb(${primary}), ${primaryHover})`,
    '--primary-fill': `rgb(${primary})`,
    '--row-hover': `color-mix(in srgb, rgb(${primary}) 7%, rgb(${surface}))`,
    '--surface-hover': `color-mix(in srgb, rgb(${textPrimary}) 6%, rgb(${surface}))`,
    '--table-head': `rgb(${surfaceMuted})`,
    '--input-bg': `rgb(${surface})`,
    '--success': `rgb(${success})`,
    '--success-soft': `color-mix(in srgb, rgb(${success}) 12%, rgb(${surface}))`,
    '--warning': `rgb(${warning})`,
    '--warning-soft': `color-mix(in srgb, rgb(${warning}) 12%, rgb(${surface}))`,
    '--error': `rgb(${danger})`,
    '--error-soft': `color-mix(in srgb, rgb(${danger}) 10%, rgb(${surface}))`,
    '--info': `rgb(${focus})`,
    '--info-soft': `color-mix(in srgb, rgb(${focus}) 10%, rgb(${surface}))`,
    '--overlay': `rgb(${textPrimary} / .55)`,

    '--sidebar-rgb': surface,
    '--sidebar-foreground-rgb': textPrimary,
    '--sidebar-muted-rgb': textMuted,
    '--sidebar-border-rgb': border,
    '--sidebar-icon-rgb': surfaceMuted,
    '--sidebar-current-icon-rgb': primaryForeground,
    '--sidebar-current-fg-rgb': textPrimary,
    '--sidebar-background': `rgb(${surface})`,
    '--sidebar-foreground': `rgb(${textPrimary})`,
    '--sidebar-muted': `rgb(${textMuted})`,
    '--sidebar-border': `rgb(${border})`,
    '--sidebar-accent': `color-mix(in srgb, rgb(${primary}) 9%, rgb(${surface}))`,
    '--sidebar-accent-foreground': `rgb(${textPrimary})`,
    '--sidebar-current-surface': `color-mix(in srgb, rgb(${primary}) 9%, rgb(${surface}))`,
    '--sidebar-current-foreground': `rgb(${textPrimary})`,
    '--sidebar-current-border': `rgb(${primary})`,
    '--sidebar-current-icon': `rgb(${primaryForeground})`,
    '--sidebar-current-icon-foreground': `rgb(${primary})`,

    '--radius-control': radiusControl,
    '--radius-card': radius,
    '--radius-panel': radiusPanel,
    '--radius-modal': radiusPanel,
    '--radius-small': radiusSmall,
    '--shadow-sm': themeVars['--sf-shadow-soft'] || '0 2px 8px color-mix(in srgb, var(--sf-ink) 10%, transparent)',
    '--shadow-md': themeVars['--sf-shadow'] || '0 8px 24px color-mix(in srgb, var(--sf-ink) 14%, transparent)',
    '--shadow-lg': '0 22px 60px color-mix(in srgb, var(--sf-ink) 24%, transparent)',
    '--shadow': themeVars['--sf-shadow-soft'] || '0 6px 18px color-mix(in srgb, var(--sf-ink) 10%, transparent)',
  }
}

export default function AdminThemeShell({
  children,
  themeVars,
  themeConfig,
}: {
  children: ReactNode
  themeVars: ThemeVars
  themeConfig: RuntimeThemeMap
}) {
  const themeRootRef = useRef<HTMLDivElement>(null)
  const [activeThemeVars, setActiveThemeVars] = useState<ThemeVars>(themeVars)

  const apply = (vars: ThemeVars) => {
    const root = document.documentElement
    root.style.colorScheme = root.dataset.mode === 'light' ? 'light' : 'dark'
    const adminVars = buildAdminCssVariables(vars)
    // Keep the global defaults and the CMS subtree in sync. The wrapper carries
    // initial inline tokens to avoid a flash on first paint, so theme changes
    // must update that wrapper too (inherited root variables cannot override it).
    for (const target of [root, themeRootRef.current]) {
      if (!target) continue
      Object.entries(adminVars).forEach(([key, value]) => target.style.setProperty(key, value))
    }
  }

  const initialVars = buildAdminCssVariables(activeThemeVars)

  useEffect(() => {
    const root = document.documentElement
    setActiveThemeVars(themeVars)
    apply(themeVars)

    const handleThemeUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{
        theme?: string
        mode?: 'light' | 'dark'
        tokens?: Record<string, string>
        shape?: RuntimeShapeName
      }>).detail
      if (!detail) return

      const themeName = detail.theme && themeConfig[detail.theme]
        ? detail.theme
        : Object.keys(themeConfig)[0] || 'forest'
      const mode = detail.mode || (root.dataset.mode === 'dark' ? 'dark' : 'light')
      const shape = detail.shape || (root.dataset.shape === 'soft' || root.dataset.shape === 'square' ? root.dataset.shape : 'rounded')
      const vars = buildThemeCssVariables(themeConfig, themeName, mode, detail.tokens || {}, shape)
      setActiveThemeVars(vars)

      root.dataset.theme = themeName
      root.dataset.mode = mode
      root.dataset.shape = shape
      apply(vars)
    }

    window.addEventListener('sf-theme-updated', handleThemeUpdate)
    return () => window.removeEventListener('sf-theme-updated', handleThemeUpdate)
  }, [themeConfig, themeVars])

  return (
    <div ref={themeRootRef} className="admin-theme-root" style={initialVars as CSSProperties}>
      {children}
    </div>
  )
}
