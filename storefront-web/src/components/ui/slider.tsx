import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> {
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value?.[0]}
      defaultValue={defaultValue?.[0]}
      onChange={(e) => onValueChange?.([Number(e.currentTarget.value)])}
      className={cn('w-full accent-primary', className)}
      {...props}
    />
  ),
)
Slider.displayName = 'Slider'

export { Slider }
