import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AddressFieldValues = {
  street: string
  city: string
  state: string
  postal: string
  country: string
}

const labelClass = 'text-xs text-muted-foreground uppercase tracking-wide'

export function AddressFields({
  values,
  onChange,
  disabled,
  idPrefix = 'addr',
  compact,
}: {
  values: AddressFieldValues
  onChange: (patch: Partial<AddressFieldValues>) => void
  disabled?: boolean
  idPrefix?: string
  /** Street on one row; city / state / postal / country on a second row. */
  compact?: boolean
}) {
  const inputClass = compact ? 'mt-0.5 h-8' : 'mt-1'

  const street = (
    <div className={compact ? 'col-span-2 sm:col-span-4' : undefined}>
      <Label htmlFor={`${idPrefix}-street`} className={labelClass}>
        Street Address
      </Label>
      <Input
        id={`${idPrefix}-street`}
        value={values.street}
        onChange={(e) => onChange({ street: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </div>
  )

  const city = (
    <div>
      <Label htmlFor={`${idPrefix}-city`} className={labelClass}>
        City
      </Label>
      <Input
        id={`${idPrefix}-city`}
        value={values.city}
        onChange={(e) => onChange({ city: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </div>
  )

  const state = (
    <div>
      <Label htmlFor={`${idPrefix}-state`} className={labelClass}>
        State
      </Label>
      <Input
        id={`${idPrefix}-state`}
        value={values.state}
        onChange={(e) => onChange({ state: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </div>
  )

  const postal = (
    <div>
      <Label htmlFor={`${idPrefix}-postal`} className={labelClass}>
        Postal Code
      </Label>
      <Input
        id={`${idPrefix}-postal`}
        value={values.postal}
        onChange={(e) => onChange({ postal: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </div>
  )

  const country = (
    <div>
      <Label htmlFor={`${idPrefix}-country`} className={labelClass}>
        Country
      </Label>
      <Input
        id={`${idPrefix}-country`}
        value={values.country}
        onChange={(e) => onChange({ country: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </div>
  )

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-4">
        {street}
        {city}
        {state}
        {postal}
        {country}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {street}
      <div className="grid grid-cols-2 gap-2">
        {city}
        {state}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {postal}
        {country}
      </div>
    </div>
  )
}

/** Card chrome matching the admin business-account Address block. */
export function AddressCard({
  title = 'Address',
  className,
  headerRight,
  compact,
  children,
}: {
  title?: string
  className?: string
  headerRight?: ReactNode
  compact?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-background', className)}>
      <div className={cn('flex items-center justify-between gap-2', compact ? 'px-3 py-2' : 'px-4 py-3')}>
        <h3 className={cn('flex items-center gap-1.5 font-semibold', compact ? 'text-xs' : 'text-sm')}>
          <MapPin className={cn('text-muted-foreground', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          {title}
        </h3>
        {headerRight}
      </div>
      <div className={compact ? 'px-3 pb-3' : 'px-4 pb-4'}>{children}</div>
    </div>
  )
}
