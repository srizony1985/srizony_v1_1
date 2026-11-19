'use client'

import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import ToastProvider from '@/components/ui/ToastProvider'
import { getThemeTypography } from '@/lib/api/adminTheme'
import { useSharedThemeMode } from '@/lib/useSharedThemeMode'
import {
  DEFAULT_THEME_TYPOGRAPHY_SETTINGS,
  THEME_FONT_FAMILIES,
  normalizeThemeTypographySettings,
  type ThemeTypographyScopedSettings,
} from '@/lib/themeTypography'

export type AdminMode = 'light' | 'dark'

type AdminThemeContextValue = { mode: AdminMode; setMode: (mode: AdminMode) => void }
const AdminThemeContext = createContext<AdminThemeContextValue>({ mode: 'dark', setMode: () => undefined })

export function useAdminTheme() {
  return useContext(AdminThemeContext)
}

type CmsTypographyStyle = CSSProperties & Record<`--cms-${string}`, string | number>

function createCmsTypographyStyle(settings: ThemeTypographyScopedSettings): CmsTypographyStyle {
  const typography = { ...settings.global, ...settings.cms }
  return {
    fontFamily: 'var(--cms-font-body)',
    fontSize: 'var(--cms-base-font-size)',
    fontWeight: typography.bodyWeight,
    lineHeight: typography.lineHeight,
    letterSpacing: 'var(--cms-letter-spacing)',
    '--cms-font-body': THEME_FONT_FAMILIES[typography.bodyFont],
    '--cms-font-display': THEME_FONT_FAMILIES[typography.displayFont],
    '--cms-base-font-size': `${typography.baseSize}px`,
    '--cms-body-font-weight': typography.bodyWeight,
    '--cms-heading-font-weight': typography.headingWeight,
    '--cms-heading-scale': typography.headingScale,
    '--cms-line-height': typography.lineHeight,
    '--cms-letter-spacing': `${typography.letterSpacing}em`,
    '--cms-sidebar-font-size': `${typography.adminSidebarSize}px`,
    '--cms-toolbar-font-size': `${typography.adminToolbarSize}px`,
    '--cms-table-font-size': `${typography.adminTableSize}px`,
    '--cms-control-font-size': `${typography.adminControlSize}px`,
    '--cms-header-font-size': `${typography.adminHeaderSize}px`,
    '--cms-data-heading-font-size': `${typography.adminDataHeadingSize}px`,
    '--cms-footer-font-size': `${typography.adminFooterSize}px`,
  }
}

export default function AdminThemeShell({ children, initialMode = 'dark' }: { children: ReactNode; initialMode?: AdminMode }) {
  const { mode, setMode } = useSharedThemeMode(initialMode)
  const [typography, setTypography] = useState<ThemeTypographyScopedSettings>(DEFAULT_THEME_TYPOGRAPHY_SETTINGS)

  useEffect(() => {
    let active = true
    const loadTypography = () => {
      void getThemeTypography()
        .then((payload) => {
          if (!active) return
          setTypography(normalizeThemeTypographySettings(payload.typography || DEFAULT_THEME_TYPOGRAPHY_SETTINGS))
        })
        .catch(() => {
          // Keep the validated local defaults if the settings API is temporarily unavailable.
        })
    }
    loadTypography()
    window.addEventListener('sf-admin-typography-updated', loadTypography)
    return () => {
      active = false
      window.removeEventListener('sf-admin-typography-updated', loadTypography)
    }
  }, [])

  const contextValue = useMemo(() => ({ mode, setMode }), [mode, setMode])
  const typographyStyle = useMemo(() => createCmsTypographyStyle(typography), [typography])

  return (
    <AdminThemeContext.Provider value={contextValue}>
      <div
        className={`admin-theme-root min-h-dvh bg-background text-foreground antialiased ${mode === 'dark' ? 'dark' : ''}`}
        data-admin-mode={mode}
        data-cms-typography-loaded="true"
        style={typographyStyle}
      >
        <ToastProvider />
        {children}
      </div>
    </AdminThemeContext.Provider>
  )
}
