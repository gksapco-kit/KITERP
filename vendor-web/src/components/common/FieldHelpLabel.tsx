import type { ReactNode, RefObject } from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'
import type { FieldDbMeta } from '@/lib/fieldDbRegistry'
import { useFieldHelpUi } from '@/lib/fieldHelpUi'

type Props = {
  children: ReactNode
  hoverHint: string
  fullHelp: string
  required?: boolean
  className?: string
  htmlFor?: string
  footerNote?: string
  dbMeta?: FieldDbMeta | null
}

export function FieldHelpLabel({
  children,
  hoverHint,
  fullHelp,
  required,
  className,
  htmlFor,
  footerNote,
  dbMeta,
}: Props) {
  const labelText = typeof children === 'string' ? children : undefined
  const { anchorRef, interactiveProps, hoverTooltip, helpDialog } = useFieldHelpUi({
    hoverHint,
    fullHelp,
    title: labelText,
    footerNote,
    dbMeta,
  })

  return (
    <>
      <LabelPrimitive.Root htmlFor={htmlFor} className={cn(className)}>
        <span ref={anchorRef as RefObject<HTMLSpanElement>} {...interactiveProps}>
          {children}
          {required ? <span className="text-red-500">*</span> : null}
        </span>
      </LabelPrimitive.Root>
      {hoverTooltip}
      {helpDialog}
    </>
  )
}
