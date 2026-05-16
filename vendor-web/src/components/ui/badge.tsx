import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'soft'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default:     'bg-primary text-white',
  secondary:   'bg-gray-100 text-gray-700',
  outline:     'border border-gray-200 text-gray-600 bg-transparent',
  destructive: 'bg-red-100 text-red-700',
  success:     'bg-green-100 text-green-700',
  warning:     'bg-amber-100 text-amber-700',
  soft:        'bg-blue-50 text-blue-700 border border-blue-100',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
