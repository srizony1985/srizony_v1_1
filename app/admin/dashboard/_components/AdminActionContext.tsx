'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

export type AdminActionHandlers = {
  save?: () => void | Promise<void>
  reload?: () => void | Promise<void>
  dirty?: boolean
  saving?: boolean
  label?: string
  /** Optional measured service baseline; omitted rather than inventing a time estimate. */
  estimatedDurationMs?: number
}

type AdminActionContextValue = {
  register: (id: string, handlers: AdminActionHandlers) => () => void
  notify: () => void
  hasSave: boolean
  hasReload: boolean
  dirty: boolean
  saving: boolean
  runSave: () => Promise<void>
  runReload: () => Promise<void>
  execution: { action: 'save' | 'reload'; label: string; status: 'running' | 'completed' | 'partial'; actualDurationMs?: number; estimatedDurationMs?: number; completedAt?: string } | null
}

const AdminActionContext = createContext<AdminActionContextValue | null>(null)

export function AdminActionProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, AdminActionHandlers>())
  const [registeredHandlers, setRegisteredHandlers] = useState<AdminActionHandlers[]>([])
  const [execution, setExecution] = useState<AdminActionContextValue['execution']>(null)
  const notify = useCallback(() => {
    setRegisteredHandlers([...registrations.current.values()])
  }, [])

  const register = useCallback((id: string, handlers: AdminActionHandlers) => {
    registrations.current.set(id, handlers)
    setRegisteredHandlers([...registrations.current.values()])
    return () => {
      if (registrations.current.get(id) === handlers) {
        registrations.current.delete(id)
        setRegisteredHandlers([...registrations.current.values()])
      }
    }
  }, [])

  const run = useCallback((action: 'save' | 'reload'): Promise<void> => {
    const entries = [...registrations.current.values()].filter((handlers) =>
      typeof handlers[action] === 'function' && (action !== 'save' || handlers.dirty === true),
    )
    if (!entries.length) {
      if (action === 'save') toast.info('There are no unsaved changes.')
      return Promise.resolve()
    }

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const estimatedDurations = entries.map((handlers) => handlers.estimatedDurationMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    const label = [...new Set(entries.map((handlers) => handlers.label).filter((value): value is string => Boolean(value)))].join(', ') || (action === 'save' ? 'Workspace save' : 'Workspace reload')
    setExecution({ action, label, status: 'running', ...(estimatedDurations.length ? { estimatedDurationMs: Math.max(...estimatedDurations) } : {}) })
    return Promise.allSettled(entries.map((handlers) => Promise.resolve().then(() => handlers[action]?.())))
      .then((results) => {
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
        setExecution({ action, label, status: failures.length ? 'partial' : 'completed', actualDurationMs: Math.max(0, Math.round(endedAt - startedAt)), ...(estimatedDurations.length ? { estimatedDurationMs: Math.max(...estimatedDurations) } : {}), completedAt: new Date().toISOString() })
        if (!failures.length) return
        const first = failures[0].reason
        toast.error(action === 'save' ? 'Some changes could not be saved.' : 'Some sections could not be reloaded.', {
          description: first instanceof Error ? first.message : 'Review the affected editor and try again.',
        })
      })
  }, [])

  const hasUnsavedChanges = registeredHandlers.some((entry) => entry.dirty === true)
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsavedChanges])

  const value = useMemo<AdminActionContextValue>(() => {
    const entries = registeredHandlers
    return {
      register,
      notify,
      hasSave: entries.some((entry) => typeof entry.save === 'function'),
      hasReload: entries.some((entry) => typeof entry.reload === 'function'),
      dirty: entries.some((entry) => entry.dirty === true),
      saving: entries.some((entry) => entry.saving === true),
      runSave: () => run('save'),
      runReload: () => run('reload'),
      execution,
    }
  }, [register, registeredHandlers, run, notify, execution])

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
  useEffect(() => { latest.current = handlers }, [handlers])
  const stableHandlers = useMemo<AdminActionHandlers>(() => ({
    save: () => latest.current.save?.(),
    reload: () => latest.current.reload?.(),
    get dirty() { return latest.current.dirty },
    get saving() { return latest.current.saving },
    get label() { return latest.current.label },
    get estimatedDurationMs() { return latest.current.estimatedDurationMs },
  }), [])
  useEffect(() => register(id, stableHandlers), [id, register, stableHandlers])
  useEffect(() => { notify() }, [notify, handlers.dirty, handlers.saving])
}
