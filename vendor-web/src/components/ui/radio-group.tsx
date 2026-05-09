import * as React from 'react'
import { cn } from '@/lib/utils'

const RadioGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: string; onValueChange?: (value: string) => void }>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('grid gap-2', className)} {...props} />,
)
RadioGroup.displayName = 'RadioGroup'

const RadioGroupItem = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} type="radio" className={cn('h-4 w-4 accent-primary', className)} {...props} />
  ),
)
RadioGroupItem.displayName = 'RadioGroupItem'

export { RadioGroup, RadioGroupItem }
