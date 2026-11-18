'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ThemeTypographyPreferences } from '@/lib/themeTypography'

export type AdminComponentTypographyKey =
  | 'adminSidebarSize'
  | 'adminToolbarSize'
  | 'adminTableSize'
  | 'adminControlSize'
  | 'adminHeaderSize'
  | 'adminDataHeadingSize'
  | 'adminFooterSize'

type ControlDefinition = {
  key: AdminComponentTypographyKey
  label: string
  description: string
  min: number
  max: number
  step: number
}

const CONTROLS: ControlDefinition[] = [
  { key: 'adminSidebarSize', label: 'Sidebar text', description: 'Navigation links and section labels', min: 10, max: 16, step: 1 },
  { key: 'adminToolbarSize', label: 'Toolbar text', description: 'Context toolbar descriptions and tabs', min: 11, max: 17, step: 1 },
  { key: 'adminTableSize', label: 'Table text', description: 'Column headings and data rows', min: 10, max: 16, step: 1 },
  { key: 'adminControlSize', label: 'Control text', description: 'Buttons, inputs, filters and badges', min: 11, max: 17, step: 1 },
  { key: 'adminHeaderSize', label: 'App header', description: 'Current viewport title and header identity', min: 11, max: 18, step: 1 },
  { key: 'adminDataHeadingSize', label: 'Data container heading', description: 'Dataset and editor panel titles', min: 12, max: 22, step: 1 },
  { key: 'adminFooterSize', label: 'Status and footer', description: 'Provider status, execution status and summaries', min: 9, max: 14, step: 1 },
]

export function AdminTypographyControls({
  value,
  onChange,
  disabled = false,
}: {
  value: ThemeTypographyPreferences
  onChange: (key: AdminComponentTypographyKey, nextValue: number) => void
  disabled?: boolean
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4" aria-labelledby="admin-component-typography-title" data-cms-component-typography>
      <div className="grid gap-1">
        <h3 id="admin-component-typography-title" className="m-0 text-base font-semibold text-foreground">CMS component typography</h3>
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">Adjust the text scale of shared admin components. These values are saved with the CMS typography scope and applied across the workspace.</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {CONTROLS.map((control) => (
          <label key={control.key} className="grid min-w-0 gap-2" htmlFor={`typography-${control.key}`}>
            <span className="flex min-w-0 items-center justify-between gap-3 text-sm font-medium text-foreground">
              <span className="min-w-0 truncate">{control.label}</span>
              <output className="shrink-0 tabular-nums text-muted-foreground" htmlFor={`typography-${control.key}`}>{value[control.key]}px</output>
            </span>
            <Input
              id={`typography-${control.key}`}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={value[control.key]}
              disabled={disabled}
              onChange={(event) => onChange(control.key, Number(event.target.value))}
              aria-describedby={`typography-${control.key}-description`}
              className={cn('h-7 cursor-pointer border-0 bg-transparent px-0 shadow-none accent-primary focus-visible:ring-2', disabled && 'cursor-not-allowed opacity-60')}
            />
            <span id={`typography-${control.key}-description`} className="text-xs leading-relaxed text-muted-foreground">{control.description} · {control.min}–{control.max}px</span>
          </label>
        ))}
      </div>
    </section>
  )
}
