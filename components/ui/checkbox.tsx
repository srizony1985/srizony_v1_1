'use client'

import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CheckboxProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  indeterminate?: boolean
}

/** shadcn-styled native checkbox: keeps native keyboard, form and screen-reader behavior. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onChange, disabled, indeterminate = false, ...props }, forwardedRef) => {
    const localRef = React.useRef<HTMLInputElement | null>(null)
    const setRef = React.useCallback((node: HTMLInputElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    }, [forwardedRef])

    React.useEffect(() => {
      if (localRef.current) localRef.current.indeterminate = indeterminate
    }, [indeterminate])

    return (
      <span className="relative inline-flex size-4 shrink-0 align-middle">
        <input
          ref={setRef}
          data-slot="checkbox"
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : checked}
          className={cn(
            'peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-background shadow-xs outline-none transition-colors checked:border-primary checked:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
            indeterminate && 'border-primary bg-primary',
            className,
          )}
          {...props}
        />
        {indeterminate
          ? <Minus aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground" />
          : <Check aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />}
      </span>
    )
  },
)
Checkbox.displayName = 'Checkbox'
