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
}: {
  values: AddressFieldValues
  onChange: (patch: Partial<AddressFieldValues>) => void
  disabled?: boolean
  idPrefix?: string
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={`${idPrefix}-street`} className={labelClass}>
          Street Address
        </Label>
        <Input
          id={`${idPrefix}-street`}
          value={values.street}
          onChange={(e) => onChange({ street: e.target.value })}
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${idPrefix}-city`} className={labelClass}>
            City
          </Label>
          <Input
            id={`${idPrefix}-city`}
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-state`} className={labelClass}>
            State
          </Label>
          <Input
            id={`${idPrefix}-state`}
            value={values.state}
            onChange={(e) => onChange({ state: e.target.value })}
            disabled={disabled}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${idPrefix}-postal`} className={labelClass}>
            Postal Code
          </Label>
          <Input
            id={`${idPrefix}-postal`}
            value={values.postal}
            onChange={(e) => onChange({ postal: e.target.value })}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-country`} className={labelClass}>
            Country
          </Label>
          <Input
            id={`${idPrefix}-country`}
            value={values.country}
            onChange={(e) => onChange({ country: e.target.value })}
            disabled={disabled}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  )
}

/** Card chrome matching the admin business-account Address block. */
export function AddressCard({
  title = 'Address',
  className,
  headerRight,
  children,
}: {
  title?: string
  className?: string
  headerRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-background', className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        {headerRight}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  )
}
