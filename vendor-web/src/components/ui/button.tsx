import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base — shared by every variant/size
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none ' +
  'transition-all duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary action — explicit white label (matches .btn-brand; readable on green in dark mode)
        default:
          'bg-primary text-white shadow-sm ' +
          'hover:bg-primary/90 active:bg-primary/85 active:scale-[0.98]',

        // Danger
        destructive:
          'bg-red-500 text-white shadow-sm ' +
          'hover:bg-red-600 active:bg-red-700 active:scale-[0.98]',

        // Secondary outlined — crisp border, subtle hover
        outline:
          'border border-border bg-card text-foreground shadow-sm ' +
          'hover:bg-accent hover:border-border hover:text-foreground ' +
          'active:bg-muted active:scale-[0.98]',

        // Dismiss / cancel — amber (#ffc954)
        cancel:
          'border border-[#ffc954] bg-[#ffc954] text-gray-800 shadow-sm ' +
          'hover:bg-[#ffc954]/90 hover:border-[#ffc954]/90 hover:text-gray-900 ' +
          'active:bg-[#ffc954]/85 active:scale-[0.98]',

        // Neutral fill
        secondary:
          'bg-muted text-foreground ' +
          'hover:bg-muted/80 active:bg-muted/70 active:scale-[0.98]',

        // Ghost — no background until hovered
        ghost:
          'text-muted-foreground ' +
          'hover:bg-muted hover:text-foreground ' +
          'active:bg-muted/80',

        // Soft — tinted surface using `--accent` / primary
        soft:
          'bg-accent text-primary border border-primary/15 ' +
          'hover:bg-primary/10 hover:border-primary/25 ' +
          'active:bg-primary/15 active:scale-[0.98]',

        // Inline text link
        link: 'text-primary underline-offset-4 hover:underline h-auto p-0',
      },
      size: {
        default: 'h-9 px-4 py-2 rounded-lg text-sm',
        sm:      'h-8 px-3 rounded-lg text-xs',
        xs:      'h-6 px-2 rounded-md text-xs',
        lg:      'h-11 px-6 rounded-xl text-base',
        icon:    'h-9 w-9 rounded-lg',
        'icon-sm': 'h-7 w-7 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
