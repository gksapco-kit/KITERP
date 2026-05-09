import * as React from 'react'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }>(
  ({ className, orientation = 'horizontal', ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn(orientation === 'vertical' ? 'h-full w-px bg-border' : 'h-px w-full bg-border', className)}
      {...props}
    />
  ),
)
Separator.displayName = 'Separator'

export { Separator }
