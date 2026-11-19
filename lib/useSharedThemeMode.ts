'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  SHARED_THEME_MODE_EVENT,
  SHARED_THEME_MODE_STORAGE_KEY,
  applySharedThemeMode,
  persistSharedThemeMode,
  readSharedThemeMode,
  type SharedThemeMode,
} from '@/lib/sharedThemeMode'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const handleThemeChange = () => onChange()
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SHARED_THEME_MODE_STORAGE_KEY) onChange()
  }

  window.addEventListener(SHARED_THEME_MODE_EVENT, handleThemeChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(SHARED_THEME_MODE_EVENT, handleThemeChange)
    window.removeEventListener('storage', handleStorage)
  }
}

function getSnapshot(): SharedThemeMode {
  return readSharedThemeMode('dark')
}

export function useSharedThemeMode(initialMode: SharedThemeMode = 'dark') {
  const getServerSnapshot = useCallback(() => initialMode, [initialMode])
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    applySharedThemeMode(mode)
  }, [mode])

  const setMode = useCallback((nextMode: SharedThemeMode) => {
    persistSharedThemeMode(nextMode)
  }, [])

  return { mode, setMode }
}
