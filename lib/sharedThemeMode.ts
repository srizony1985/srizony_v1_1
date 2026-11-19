export type SharedThemeMode = 'light' | 'dark'

export const SHARED_THEME_MODE_COOKIE = 'sf-mode'
export const SHARED_THEME_MODE_STORAGE_KEY = 'sf-mode'
export const SHARED_THEME_MODE_EVENT = 'sf:theme-mode-change'

export function normalizeSharedThemeMode(
  value: string | null | undefined,
  fallback: SharedThemeMode = 'dark',
): SharedThemeMode {
  return value === 'light' || value === 'dark' ? value : fallback
}

/** Read the shared cookie first; it is also the server-rendering source of truth. */
export function readSharedThemeMode(fallback: SharedThemeMode = 'dark'): SharedThemeMode {
  if (typeof document !== 'undefined') {
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SHARED_THEME_MODE_COOKIE}=`))
      ?.slice(SHARED_THEME_MODE_COOKIE.length + 1)

    if (cookie === 'light' || cookie === 'dark') return cookie
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(SHARED_THEME_MODE_STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }

  return fallback
}

/** Apply the current mode to browser chrome and any root-level theme selectors. */
export function applySharedThemeMode(mode: SharedThemeMode): void {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.mode = mode
  document.documentElement.style.colorScheme = mode

  const themeColor = mode === 'light' ? '#f4f7fa' : '#0b1117'
  const tags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  if (tags.length) {
    tags.forEach((tag) => tag.setAttribute('content', themeColor))
  } else {
    const tag = document.createElement('meta')
    tag.name = 'theme-color'
    tag.content = themeColor
    document.head.appendChild(tag)
  }
}

/** Persist and broadcast the preference to every mounted shell and browser tab. */
export function persistSharedThemeMode(mode: SharedThemeMode): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SHARED_THEME_MODE_COOKIE}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`

  try {
    window.localStorage.setItem(SHARED_THEME_MODE_STORAGE_KEY, mode)
  } catch {
    // The cookie and active-page state still work when storage is unavailable.
  }

  applySharedThemeMode(mode)
  window.dispatchEvent(new CustomEvent(SHARED_THEME_MODE_EVENT, { detail: mode }))
}
