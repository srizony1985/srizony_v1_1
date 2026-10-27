'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
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
  const radius = themeVars['--sf-radius-shape'] || '8px'

  const primaryHover = themeVars['--sf-primary-strong'] || `rgb(${primary})`
  const primaryActive = `color-mix(in srgb, rgb(${primary}) 76%, #000)`
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
    '--success-soft': `rgb(${surfaceMuted})`,
    '--warning': `rgb(${warning})`,
    '--warning-soft': `rgb(${surfaceMuted})`,
    '--error': `rgb(${danger})`,
    '--error-soft': `rgb(${surfaceMuted})`,
    '--info': `rgb(${focus})`,
    '--info-soft': `rgb(${surfaceMuted})`,
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

    '--radius-control': radius,
    '--radius-card': radius,
    '--radius-panel': radius,
    '--radius-modal': radius,
    '--shadow-sm': '0 1px 2px rgb(0 0 0 / .05)',
    '--shadow-md': '0 6px 18px rgb(0 0 0 / .10)',
    '--shadow-lg': '0 18px 48px rgb(0 0 0 / .22)',
    '--shadow': '0 6px 18px rgb(0 0 0 / .10)',
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
  const apply = (vars: ThemeVars) => {
    const root = document.documentElement
    const adminVars = buildAdminCssVariables(vars)
    Object.entries(adminVars).forEach(([key, value]) => root.style.setProperty(key, value))
  }

  const initialVars = buildAdminCssVariables(themeVars)

  useEffect(() => {
    const root = document.documentElement
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

      root.dataset.theme = themeName
      root.dataset.mode = mode
      root.dataset.shape = shape
      apply(vars)
    }

    window.addEventListener('sf-theme-updated', handleThemeUpdate)
    return () => window.removeEventListener('sf-theme-updated', handleThemeUpdate)
  }, [themeConfig, themeVars])

  return (
    <div className="admin-theme-root" style={initialVars as CSSProperties}>
      {children}
    </div>
  )
}
