import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type TextLabelProps = {
  children: string
  className?: string
  helpKey?: string
  required?: boolean
  dbTable?: string
  dbField?: string
  dbNote?: string
}

/** Standard form field label with hover / click / F1 help. */
export function FieldLabel({
  children,
  className,
  helpKey,
  required,
  dbTable,
  dbField,
  dbNote,
}: TextLabelProps) {
  return (
    <Label
      className={className}
      helpKey={helpKey}
      required={required}
      dbTable={dbTable}
      dbField={dbField}
      dbNote={dbNote}
    >
      {children}
    </Label>
  )
}

/** Table or report column header with field help. */
export function TableColumnLabel({
  children,
  className,
  helpKey,
  dbTable,
  dbField,
  dbNote,
}: TextLabelProps) {
  return (
    <Label
      helpKey={helpKey}
      dbTable={dbTable}
      dbField={dbField}
      dbNote={dbNote}
      className={cn(
        'text-xs font-medium uppercase tracking-wide text-gray-500 font-normal leading-snug',
        className,
      )}
    >
      {children}
    </Label>
  )
}

/** Inline column header above form rows (e.g. invoice line items). */
export function FormColumnLabel({
  children,
  className,
  helpKey,
  dbTable,
  dbField,
  dbNote,
}: TextLabelProps) {
  return (
    <Label
      helpKey={helpKey}
      dbTable={dbTable}
      dbField={dbField}
      dbNote={dbNote}
      className={cn('text-xs font-medium uppercase text-gray-400 font-normal', className)}
    >
      {children}
    </Label>
  )
}

/** Report section / filter group title with field help. */
export function SectionLabel({ children, className, helpKey }: TextLabelProps) {
  return (
    <Label
      helpKey={helpKey}
      className={cn(
        'text-xs font-medium uppercase tracking-wide text-gray-500 font-normal',
        className,
      )}
    >
      {children}
    </Label>
  )
}

type CheckboxFieldLabelProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
  inputClassName?: string
  labelClassName?: string
  helpKey?: string
  disabled?: boolean
  id?: string
}

/** Checkbox with a help-enabled label (hover / click / F1 on label text). */
export function CheckboxFieldLabel({
  label,
  checked,
  onChange,
  className,
  inputClassName,
  labelClassName,
  helpKey,
  disabled,
  id,
}: CheckboxFieldLabelProps) {
  const inputId = id ?? `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn('h-4 w-4 shrink-0 rounded', inputClassName)}
      />
      <Label htmlFor={inputId} helpKey={helpKey} className={cn('text-sm font-normal', labelClassName)}>
        {label}
      </Label>
    </div>
  )
}

/** Optional wrapper for custom checkbox children. */
export function CheckboxFieldRow({
  label,
  helpKey,
  className,
  labelClassName,
  children,
}: {
  label: string
  helpKey?: string
  className?: string
  labelClassName?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
      <Label helpKey={helpKey} className={cn('text-sm font-normal', labelClassName)}>
        {label}
      </Label>
    </div>
  )
}

export { Label }
