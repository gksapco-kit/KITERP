import * as React from 'react'
import { cn, focusRingClassName, formFieldBorderClassName } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const DATE_LIKE = ['date', 'datetime-local', 'time', 'month', 'week']

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, onClick, ...props }, ref) => {
  const isDateLike = !!type && DATE_LIKE.includes(type)
  return (
    <input
      type={type}
      onClick={
        isDateLike
          ? (e) => {
              onClick?.(e)
              // Open the native date/time picker on click anywhere in the field,
              // so it works even if the tiny calendar icon is hard to see/hit.
              try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.() } catch { /* not supported */ }
            }
          : onClick
      }
      className={cn(
        `flex h-10 w-full rounded-md ${formFieldBorderClassName} bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50`,
        focusRingClassName,
        // Keep the native calendar/clock indicator clearly visible, enlarged, and
        // padded away from the right edge so it has breathing space.
        isDateLike && 'pr-9 cursor-pointer [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:[width:1.2rem] [&::-webkit-calendar-picker-indicator]:[height:1.2rem] [&::-webkit-calendar-picker-indicator]:[margin-inline-start:0.5rem]',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
