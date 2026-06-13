import type { LabelHTMLAttributes } from 'react'
import { Label, extractPlainLabel, type LabelProps } from '@/components/ui/label'

type InlineProps = {
  label: string
  className?: string
  required?: boolean
  helpKey?: string
  htmlFor?: string
  autoHelp?: boolean
}

/** Label text with red required mark and shared hover / click / F1 field help. */
export function InlineFieldLabel({
  label,
  className,
  required: requiredProp,
  helpKey,
  htmlFor,
  autoHelp,
}: InlineProps) {
  const { text, required: requiredFromLabel } = extractPlainLabel(label)
  const required = requiredProp ?? requiredFromLabel
  const displayText = text || label.replace(/\s*\*+\s*$/, '').trim()

  return (
    <Label
      className={className}
      required={required}
      helpKey={helpKey}
      htmlFor={htmlFor}
      autoHelp={autoHelp}
    >
      {displayText}
    </Label>
  )
}

/** Drop-in for `<label className="…">Name *</label>` with shared field help. */
export function NativeFormLabel({
  children,
  className,
  required,
  helpKey,
  htmlFor,
  autoHelp,
  ...props
}: Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> &
  Pick<LabelProps, 'helpKey' | 'autoHelp'> & {
    children: string
    required?: boolean
  }) {
  const { text, required: requiredFromChild } = extractPlainLabel(children)
  const isRequired = required ?? requiredFromChild
  const displayText = text || children.replace(/\s*\*+\s*$/, '').trim()

  return (
    <Label
      className={className}
      required={isRequired}
      helpKey={helpKey}
      htmlFor={htmlFor}
      autoHelp={autoHelp}
      {...props}
    >
      {displayText}
    </Label>
  )
}
