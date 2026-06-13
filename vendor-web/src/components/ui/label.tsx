import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { FieldHelpLabel } from '@/components/common/FieldHelpLabel'
import { resolveFieldHelp } from '@/lib/fieldHelpRegistry'
import { resolveFieldDbMeta } from '@/lib/fieldDbRegistry'

const labelVariants = cva('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70')

function extractPlainLabel(children: React.ReactNode): { text: string; required: boolean } {
  if (typeof children === 'string') {
    const trimmed = children.trim()
    const required = /\*\s*$/.test(trimmed) || trimmed.includes('*')
    const text = trimmed.replace(/\s*\*+\s*/g, ' ').trim()
    return { text, required: required && text.length > 0 }
  }
  if (Array.isArray(children)) {
    const parts = children
      .map((c) => (typeof c === 'string' ? c : c === null || c === false ? '' : ''))
      .join('')
    return extractPlainLabel(parts)
  }
  return { text: '', required: false }
}

export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants> & {
    /** Lookup key in field help registry (defaults to normalized label text). */
    helpKey?: string
    hoverHint?: string
    fullHelp?: string
    /** Show hover + F1 help (default true for plain-text labels). */
    autoHelp?: boolean
    /** Database table override for wrench icon in help popup. */
    dbTable?: string
    dbField?: string
    dbNote?: string
  }

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  (
    {
      className,
      helpKey,
      hoverHint,
      fullHelp,
      autoHelp = true,
      required: requiredProp,
      dbTable,
      dbField,
      dbNote,
      children,
      ...props
    },
    ref,
  ) => {
    const { text, required: requiredFromChild } = extractPlainLabel(children)
    const required = requiredProp ?? requiredFromChild
    const labelText = text || (typeof children === 'string' ? children.replace(/\*+/g, '').trim() : '')

    const help =
      autoHelp !== false
        ? resolveFieldHelp({
            helpKey: helpKey ?? labelText,
            hoverHint,
            fullHelp,
            labelText,
          })
        : null

    const dbMeta = resolveFieldDbMeta({
      helpKey: helpKey ?? labelText,
      labelText,
      dbTable,
      dbField,
      dbNote,
    })

    if (help && labelText) {
      return (
        <FieldHelpLabel
          htmlFor={props.htmlFor}
          className={cn(labelVariants(), className)}
          hoverHint={help.hover}
          fullHelp={help.full}
          footerNote={help.footerNote}
          dbMeta={dbMeta}
          required={required}
        >
          {labelText}
        </FieldHelpLabel>
      )
    }

    const showRequiredMark = required && labelText

    return (
      <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props}>
        {showRequiredMark ? (
          <>
            {labelText}
            <span className="text-red-500" aria-hidden>
              *
            </span>
          </>
        ) : (
          children
        )}
      </LabelPrimitive.Root>
    )
  },
)
Label.displayName = LabelPrimitive.Root.displayName

export { Label, extractPlainLabel }
