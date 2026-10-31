'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

export type AdminActionHandlers = {
  save?: () => void | Promise<void>
  reload?: () => void | Promise<void>
  dirty?: boolean
  saving?: boolean
  label?: string
}

type Registration = { id: string; handlers: AdminActionHandlers }
type AdminActionContextValue = {
  register: (id: string, handlers: AdminActionHandlers) => () => void
  notify: () => void
  hasSave: boolean
  hasReload: boolean
  dirty: boolean
  saving: boolean
  runSave: () => Promise<void>
  runReload: () => Promise<void>
}

const AdminActionContext = createContext<AdminActionContextValue | null>(null)

export function AdminActionProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, AdminActionHandlers>())
  const [revision, setRevision] = useState(0)
  const notify = useCallback(() => setRevision((value) => value + 1), [])

  const register = useCallback((id: string, handlers: AdminActionHandlers) => {
    registrations.current.set(id, handlers)
    setRevision((value) => value + 1)
    return () => {
      if (registrations.current.get(id) === handlers) {
        registrations.current.delete(id)
        setRevision((value) => value + 1)
      }
    }
  }, [])

  const run = useCallback(async (action: 'save' | 'reload') => {
    const entries = [...registrations.current.values()].filter((handlers) =>
      typeof handlers[action] === 'function' && (action !== 'save' || handlers.dirty === true),
    )
    if (!entries.length) {
      if (action === 'save') toast.info('There are no unsaved changes.')
      return
    }

    const results = await Promise.allSettled(entries.map((handlers) => Promise.resolve().then(() => handlers[action]?.())))
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failures.length) {
      const first = failures[0].reason
      toast.error(action === 'save' ? 'Some changes could not be saved.' : 'Some sections could not be reloaded.', {
        description: first instanceof Error ? first.message : 'Review the affected editor and try again.',
      })
      return
    }
  }, [])

  const hasUnsavedChanges = [...registrations.current.values()].some((entry) => entry.dirty === true)
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsavedChanges, revision])

  const value = useMemo<AdminActionContextValue>(() => {
    const entries = [...registrations.current.values()]
    return {
      register,
      notify,
      hasSave: entries.some((entry) => typeof entry.save === 'function'),
      hasReload: entries.some((entry) => typeof entry.reload === 'function'),
      dirty: entries.some((entry) => entry.dirty === true),
      saving: entries.some((entry) => entry.saving === true),
      runSave: () => run('save'),
      runReload: () => run('reload'),
    }
  }, [register, revision, run, notify])

  return <AdminActionContext.Provider value={value}>{children}</AdminActionContext.Provider>
}

export function useAdminActions() {
  const context = useContext(AdminActionContext)
  if (!context) {
    throw new Error('useAdminActions must be used inside AdminActionProvider.')
  }
  return context
}

export function useRegisterAdminActions(id: string, handlers: AdminActionHandlers) {
  const { register, notify } = useAdminActions()
  const latest = useRef(handlers)
  latest.current = handlers
  const stableHandlers = useMemo<AdminActionHandlers>(() => ({
    save: () => latest.current.save?.(),
    reload: () => latest.current.reload?.(),
    get dirty() { return latest.current.dirty },
    get saving() { return latest.current.saving },
    get label() { return latest.current.label },
  }), [id])
  useEffect(() => register(id, stableHandlers), [id, register, stableHandlers])
  useEffect(() => { notify() }, [notify, handlers.dirty, handlers.saving])
}
