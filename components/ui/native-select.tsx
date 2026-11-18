import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * shadcn-style NativeSelect primitive.
 * Uses the browser's native select semantics, keyboard model and form behavior;
 * the wrapper and control follow the project's shadcn design tokens.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <span data-slot="native-select-wrapper" className="relative block min-w-0">
      <select
        ref={ref}
        data-slot="native-select"
        className={cn('border-input dark:bg-input/30 h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-1 pr-8 text-(length:--cms-control-font-size,14px) shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  )
})
NativeSelect.displayName = 'NativeSelect'
