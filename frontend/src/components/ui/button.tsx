import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, focusRingClassName, hasSolidPrimaryBgClass, isSolidPrimaryButtonClassName, solidButtonFocusClassName } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 ' +
          solidButtonFocusClassName,
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 ' +
          solidButtonFocusClassName,
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground ' +
          focusRingClassName,
        cancel:
          'border border-[#ffc954] bg-[#ffc954] text-gray-700 shadow-sm ' +
          'hover:bg-[#ffc954]/90 hover:border-[#ffc954]/90 hover:text-gray-900 ' +
          'active:bg-[#ffc954]/85 ' +
          focusRingClassName,
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 ' +
          focusRingClassName,
        ghost: 'hover:bg-accent hover:text-accent-foreground ' + focusRingClassName,
        link: 'text-primary underline-offset-4 hover:underline ' + focusRingClassName,
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
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
        className={cn(
          buttonVariants({ variant, size }),
          (hasSolidPrimaryBgClass(className) || isSolidPrimaryButtonClassName(className)) &&
            variant !== 'default' &&
            variant !== 'destructive' &&
            solidButtonFocusClassName,
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
