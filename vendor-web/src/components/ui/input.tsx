import * as React from 'react'
import { cn, formFieldBorderClassName, formFieldFocusClassName } from '@/lib/utils'

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
        formFieldFocusClassName,
        isDateLike && 'cursor-pointer [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-datetime-edit]:min-w-0',
        className,
        // Last so caller `px-*` / `overflow-hidden` cannot pull the native picker
        // icon onto the rounded border (Chromium clips it against the outline).
        isDateLike && 'appearance-auto overflow-visible pr-8 [&::-webkit-calendar-picker-indicator]:mr-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80',
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
