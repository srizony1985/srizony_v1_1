'use client'

import { useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CmsTypography } from '@/types/entityType'

type Mode = 'light' | 'dark'
type TypographyKey = keyof Omit<CmsTypography, 'dark'>

const fonts: Array<{ value: NonNullable<CmsTypography['fontFamily']>; label: string }> = [
  { value: 'inherit', label: 'Theme default' }, { value: 'system', label: 'System UI' },
  { value: 'inter', label: 'Inter' }, { value: 'roboto', label: 'Roboto' },
  { value: 'arial', label: 'Arial' }, { value: 'georgia', label: 'Georgia' },
  { value: 'times', label: 'Times New Roman' }, { value: 'noto-sans-bengali', label: 'Noto Sans Bengali' },
]

const DEFAULT_COLOR: Record<Mode, string> = { light: '#28332f', dark: '#e5e7eb' }

function clean<T extends object>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, item]) => item !== undefined)) as T
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="cms-field flex flex-col gap-1.5 text-[0.875rem]">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

export default function CmsTypographyEditor({ value, onChange, title = 'Typography' }: {
  value?: CmsTypography
  onChange: (value: CmsTypography | undefined) => void
  title?: string
}) {
  const [mode, setMode] = useState<Mode>('light')
  const isDark = mode === 'dark'
  const active = isDark ? value?.dark : value
  const hasDarkOverrides = Boolean(value?.dark && Object.keys(value.dark).length)
  const inheritLabel = isDark ? 'Same as light' : 'Theme default'

  function commit(next: CmsTypography) {
    if (next.dark && !Object.keys(next.dark).length) delete next.dark
    const cleaned = clean(next)
    onChange(Object.keys(cleaned).length ? cleaned : undefined)
  }

  function set(key: TypographyKey, next: string | number) {
    const nextValue = next === '' ? undefined : next
    const base = value ?? {}
    if (isDark) commit({ ...base, dark: clean({ ...(base.dark ?? {}), [key]: nextValue }) })
    else commit({ ...base, [key]: nextValue })
  }

  function reset() {
    if (isDark) commit({ ...(value ?? {}), dark: undefined })
    else onChange(undefined)
  }

  const numberValue = (key: 'fontSize' | 'letterSpacing' | 'lineHeight') => String(active?.[key] ?? '')
  const numberChange = (key: 'fontSize' | 'letterSpacing' | 'lineHeight') =>
    (event: { target: { value: string } }) =>
      set(key, event.target.value === '' ? '' : Number(event.target.value))

  const colorFallback = isDark ? value?.dark?.color || value?.color || DEFAULT_COLOR.dark : DEFAULT_COLOR.light

  return (
    <fieldset className="cms-array-fieldset pb-typography-editor col-span-full min-w-0 rounded-(--radius) border border-border bg-background p-3">
      <legend className="px-1.5 text-xs font-semibold text-muted-foreground">{title}</legend>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border bg-muted p-0.5" role="group" aria-label="Typography mode">
          {(['light', 'dark'] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={mode === item ? 'default' : 'ghost'}
              size="sm"
              className={cn('h-8 gap-1.5 px-3 text-xs capitalize', mode !== item && 'text-muted-foreground')}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {item === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {item}
              {item === 'dark' && hasDarkOverrides && (
                <span className="size-1.5 rounded-full bg-warning" aria-label="Has dark mode overrides" />
              )}
            </Button>
          ))}
        </div>
        {isDark && (
          <p className="m-0 text-xs text-muted-foreground">Empty fields inherit the light mode value.</p>
        )}
      </div>

      <div className="cms-form-grid grid grid-cols-1 gap-2 min-[700px]:grid-cols-2">
        <Field label="Font family">
          <NativeSelect
            value={active?.fontFamily ?? (isDark ? '' : 'inherit')}
            onChange={(event) => set('fontFamily', event.target.value)}
          >
            {isDark && <option value="">{inheritLabel}</option>}
            {fonts.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </NativeSelect>
        </Field>

        <Field label="Font weight">
          <NativeSelect
            value={String(active?.fontWeight ?? (isDark ? '' : 400))}
            onChange={(event) => set('fontWeight', event.target.value === '' ? '' : Number(event.target.value))}
          >
            {isDark && <option value="">{inheritLabel}</option>}
            {[300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
          </NativeSelect>
        </Field>

        <Field label="Base font size (px)">
          <Input type="number" min={10} max={64} value={numberValue('fontSize')} placeholder={inheritLabel} onChange={numberChange('fontSize')} />
        </Field>

        <Field label="Text colour">
          <div className="pb-typography-color grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-2">
            <Input
              type="color"
              value={active?.color || colorFallback}
              onChange={(event) => set('color', event.target.value)}
              className="h-9 w-12 cursor-pointer p-1"
              aria-label={`${mode} mode text colour`}
            />
            <Input
              value={active?.color || ''}
              placeholder={isDark ? value?.color || 'Same as light' : DEFAULT_COLOR.light}
              onChange={(event) => set('color', event.target.value)}
            />
          </div>
        </Field>

        <Field label="Letter spacing (em)">
          <Input type="number" step="0.01" min={-0.1} max={0.5} value={numberValue('letterSpacing')} placeholder={inheritLabel} onChange={numberChange('letterSpacing')} />
        </Field>

        <Field label="Line height">
          <Input type="number" step="0.1" min={0.8} max={2.5} value={numberValue('lineHeight')} placeholder={inheritLabel} onChange={numberChange('lineHeight')} />
        </Field>
      </div>

      <div className="cms-form-actions mt-2 flex flex-wrap items-center justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={reset}>
          {isDark ? 'Reset dark mode' : 'Reset typography'}
        </Button>
      </div>
    </fieldset>
  )
}