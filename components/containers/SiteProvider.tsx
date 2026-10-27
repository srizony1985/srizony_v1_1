'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { ColorMode, Lang, ShapeName, ThemeName } from '@/types/entityType'
import type { PublicSiteSnapshot } from '@/types/site'
import { buildThemeCssVariables, parseThemeTokenOverrides, THEME_COLOR_TOKEN_KEYS, type RuntimeThemeMap } from '@/lib/themeRuntime'
import { getNavigationSnapshot, getPageSnapshot, getSessionProfile, getSiteSnapshot } from '@/lib/api/public'

type SiteProfile = {
  id: number
  email: string
  name: string
  phone?: string | null
  provider: 'google' | 'email'
  providerId: string
}

type SiteContextValue = {
  tokens: Record<string, string>
  setToken: (key: string, value: string) => void
  resetTokens: () => void
  lang: Lang
  setLang: (v: Lang) => void
  theme: ThemeName
  setTheme: (v: ThemeName) => void
  shape: ShapeName
  setShape: (v: ShapeName) => void
  mode: ColorMode
  setMode: (v: ColorMode) => void
  profile: SiteProfile | null
  refreshProfile: () => Promise<void>
  site: PublicSiteSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const SiteContext = createContext<SiteContextValue | null>(null)

export default function SiteProvider({
  children,
  initialPreferences,
  initialSite,
  initialLang = 'en',
}: {
  children: React.ReactNode
  initialPreferences?: {
    theme: ThemeName
    mode: ColorMode
    shape: ShapeName
    tokens?: Record<string, string>
  }
  initialSite?: PublicSiteSnapshot | null
  initialLang?: Lang
}) {
  const pathname = usePathname() || '/'
  const router = useRouter()

  const [lang, setLang] = useState<Lang>(initialLang)

  const [theme, setThemeState] = useState<ThemeName>(
    initialPreferences?.theme || 'midnight',
  )

  const [shape, setShapeState] = useState<ShapeName>(
    initialPreferences?.shape || 'soft',
  )

  const [mode, setModeState] = useState<ColorMode>(
    initialPreferences?.mode || 'dark',
  )

  const [tokens, setTokensState] = useState<Record<string, string>>(
    () => parseThemeTokenOverrides(initialPreferences?.tokens || {}),
  )

  const [profile, setProfile] = useState<SiteProfile | null>(null)

  const [site, setSite] = useState<PublicSiteSnapshot | null>(
    initialSite || null,
  )

  const [loading, setLoading] = useState(!initialSite)

  const [error, setError] = useState<string | null>(null)

  /**
   * Keep the public site's default palette consistent. The appearance
   * customizer has been removed, so legacy per-browser palette overrides are
   * discarded while the user's explicit light/dark preference is retained.
   */
  useEffect(() => {
    const storedMode = window.localStorage.getItem('sf-mode') as ColorMode | null

    try {
      window.localStorage.setItem('sf-theme', 'midnight')
      window.localStorage.setItem('sf-shape', 'soft')
      window.localStorage.removeItem('sf-theme-tokens')
    } catch {
      // Storage can be unavailable in privacy modes; the active session still works.
    }

    document.cookie = 'sf-theme=midnight;path=/;max-age=31536000;samesite=lax'
    document.cookie = 'sf-shape=soft;path=/;max-age=31536000;samesite=lax'
    document.cookie = 'sf-theme-tokens=;path=/;max-age=0;samesite=lax'

    if ((storedMode === 'light' || storedMode === 'dark') && storedMode !== mode) {
      setModeState(storedMode)
      document.cookie = `sf-mode=${storedMode};path=/;max-age=31536000;samesite=lax`
    }

    // Intentionally only runs on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Load current authenticated profile.
   */
  const refreshProfile = async () => {
    try {
      const { data } = (await getSessionProfile()) as { data: { user?: SiteProfile | null } }

      setProfile(data.user || null)
    } catch {
      setProfile(null)
    }
  }

  /**
   * Strip /bn from the pathname so the API always receives
   * the canonical content slug.
   */
  const canonicalPath =
    pathname === '/bn'
      ? '/'
      : pathname.startsWith('/bn/')
        ? pathname.slice(3) || '/'
        : pathname

  const hasSite = site !== null

  /**
   * When Next.js navigates from /admin back into the public site, the root layout
   * can be preserved from the CMS route where initialSite was intentionally null.
   * Hydrate the complete snapshot instead of leaving the shared header/footer empty.
   */
  useEffect(() => {
    if (hasSite) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getSiteSnapshot(canonicalPath, controller.signal)
      .then((response) => {
        if (!response.ok || !response.data?.global) {
          throw new Error('Unable to load the public site.')
        }
        setSite(response.data as PublicSiteSnapshot)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Unable to load the public site.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [canonicalPath, hasSite])

  /**
   * Fetch current CMS navigation on public-route entry and when the user returns
   * to the site tab. This prevents stale links in desktop nav, mobile nav and footer.
   */
  useEffect(() => {
    if (!hasSite) return

    const controller = new AbortController()
    const syncNavigation = () => {
      getNavigationSnapshot(controller.signal)
        .then((response) => {
          if (!response.ok || !Array.isArray(response.data?.primaryNav) || !Array.isArray(response.data?.navGroups)) return
          setSite((current) => current ? {
            ...current,
            global: {
              ...current.global,
              primaryNav: response.data.primaryNav,
              navGroups: response.data.navGroups,
              ...(response.data.ui ? { ui: response.data.ui } : {}),
            },
          } : current)
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') console.error('Unable to refresh CMS navigation', err)
        })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncNavigation()
    }

    syncNavigation()
    window.addEventListener('focus', syncNavigation)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      controller.abort()
      window.removeEventListener('focus', syncNavigation)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [pathname, hasSite])

  /**
   * Explicit content refresh.
   */
  const refresh = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await getPageSnapshot(canonicalPath)

      if (!response.ok) {
        throw new Error('Unable to load site content')
      }

      const data = response.data as {
        canonicalSlug: string
        page: PublicSiteSnapshot['page']
        notFound: boolean
      }

      setSite((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          canonicalSlug: data.canonicalSlug,
          page: data.page,
          notFound: data.notFound,
        }
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load site content',
      )
    } finally {
      setLoading(false)
    }
  }

  /**
   * Load page content whenever the canonical route changes.
   *
   * IMPORTANT:
   * We compare against the CURRENT site's canonicalSlug,
   * not initialSite?.canonicalSlug.
   *
   * This fixes:
   *   / -> /about-us -> /
   *
   * where the old page content previously remained in state.
   */
  useEffect(() => {
    // The full-snapshot hydration effect above owns initialization when the provider
    // was mounted with initialSite=null (for example, after leaving the CMS).
    if (!site) return

    const currentCanonicalSlug = site?.canonicalSlug

    // The current state already represents this route.
    if (currentCanonicalSlug === canonicalPath && site?.page) {
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()

    setLoading(true)
    setError(null)

    getPageSnapshot(canonicalPath, controller.signal)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load site content')
        }

        return response.data as {
          canonicalSlug: string
          page: PublicSiteSnapshot['page']
          notFound: boolean
        }
      })
      .then((data) => {
        setSite((current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            canonicalSlug: data.canonicalSlug,
            page: data.page,
            notFound: data.notFound,
          }
        })
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load site content',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [canonicalPath, site?.canonicalSlug, site?.page])

  /**
   * Persist language.
   */
  useEffect(() => {
    window.localStorage.setItem('sf-lang', lang)

    document.cookie = `sf-lang=${lang};path=/;max-age=31536000;samesite=lax`

    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
  }, [lang])

  /**
   * Change language while preserving the current canonical route.
   */
  const setLanguage = (value: Lang) => {
    setLang(value)

    const currentIsBn =
      pathname === '/bn' || pathname.startsWith('/bn/')

    const canonical = currentIsBn
      ? pathname.slice(3) || '/'
      : pathname

    const target =
      value === 'bn'
        ? canonical === '/'
          ? '/bn'
          : `/bn${canonical}`
        : canonical

    if (target !== pathname) {
      router.push(target)
    }
  }

  /**
   * Theme setters.
   */
  const setTheme = (value: ThemeName) => {
    setThemeState(value)

    window.localStorage.setItem('sf-theme', value)

    document.cookie = `sf-theme=${encodeURIComponent(
      value,
    )};path=/;max-age=31536000;samesite=lax`

    document.documentElement.dataset.theme = value
  }

  const setShape = (value: ShapeName) => {
    setShapeState(value)

    window.localStorage.setItem('sf-shape', value)

    document.cookie = `sf-shape=${encodeURIComponent(
      value,
    )};path=/;max-age=31536000;samesite=lax`

    document.documentElement.dataset.shape = value
  }

  const setMode = (value: ColorMode) => {
    setModeState(value)

    window.localStorage.setItem('sf-mode', value)

    document.cookie = `sf-mode=${value};path=/;max-age=31536000;samesite=lax`

    document.documentElement.dataset.mode = value
  }

  /**
   * Persist customization tokens in localStorage for client navigation and in
   * a small cookie so the next server render can start with the same palette.
   */
  const setToken = useCallback((key: string, value: string) => {
    if (!THEME_COLOR_TOKEN_KEYS.includes(key as (typeof THEME_COLOR_TOKEN_KEYS)[number]) || !/^#[0-9a-fA-F]{6}$/.test(value)) return
    const next = { ...tokens, [key]: value }
    setTokensState(next)
    const serialized = JSON.stringify(next)
    try { window.localStorage.setItem('sf-theme-tokens', serialized) } catch { /* Persistence may be disabled; keep the active session responsive. */ }
    document.cookie = `sf-theme-tokens=${encodeURIComponent(serialized)};path=/;max-age=31536000;samesite=lax`
  }, [tokens])

  const resetTokens = useCallback(() => {
    setTokensState({})
    try { window.localStorage.removeItem('sf-theme-tokens') } catch { /* The in-memory reset still applies. */ }
    document.cookie = 'sf-theme-tokens=;path=/;max-age=0;samesite=lax'
  }, [])

  /**
   * Keep HTML dataset attributes synchronized.
   */
  useEffect(() => {
    const root = document.documentElement

    root.dataset.theme = theme
    root.dataset.mode = mode
    root.dataset.shape = shape
  }, [theme, mode, shape])

  /**
   * Apply runtime theme variables.
   */
  useEffect(() => {
    const themeMap = (site?.global.themes || {}) as RuntimeThemeMap

    const cssVariables = buildThemeCssVariables(
      themeMap,
      theme,
      mode,
      tokens,
      shape,
    )

    ;(Object.entries(cssVariables) as Array<[string, string]>).forEach(
      ([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      },
    )
  }, [site, theme, mode, shape, tokens])

  const value = useMemo<SiteContextValue>(
    () => ({
      tokens,
      setToken,
      resetTokens,
      lang,
      setLang: setLanguage,
      theme,
      setTheme,
      shape,
      setShape,
      mode,
      setMode,
      profile,
      refreshProfile,
      site,
      loading,
      error,
      refresh,
    }),
    [
      tokens,
      setToken,
      resetTokens,
      lang,
      theme,
      shape,
      mode,
      profile,
      site,
      loading,
      error,
      pathname,
    ],
  )

  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
}

export const useSite = () => {
  const ctx = useContext(SiteContext)

  if (!ctx) {
    throw new Error('useSite must be used inside SiteProvider')
  }

  return ctx
}