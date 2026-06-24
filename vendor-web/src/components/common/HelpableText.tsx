import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { resolveFieldHelp } from '@/lib/fieldHelpRegistry'
import { useFieldHelpUi } from '@/lib/fieldHelpUi'

type HelpableTextProps = {
  children: string
  /** Registry lookup — defaults to normalized label text. */
  helpKey?: string
  hoverHint?: string
  fullHelp?: string
  footerNote?: string
  /** Dialog title override (defaults to children). */
  title?: string
  className?: string
  enabled?: boolean
}

/** Inline label or section title with hover tip + F1 / click full-help dialog. */
export function HelpableText({
  children,
  helpKey,
  hoverHint,
  fullHelp,
  footerNote,
  title,
  className,
  enabled = true,
}: HelpableTextProps) {
  const help = enabled
    ? resolveFieldHelp({ helpKey: helpKey ?? children, hoverHint, fullHelp, labelText: children })
    : null

  const { anchorRef, interactiveProps, hoverTooltip, helpDialog } = useFieldHelpUi({
    hoverHint: help?.hover ?? children,
    fullHelp: help?.full ?? children,
    title: title ?? children,
    footerNote: help?.footerNote ?? footerNote,
    enabled: enabled && !!help,
  })

  if (!help) {
    return <span className={className}>{children}</span>
  }

  return (
    <>
      <span
        ref={anchorRef as RefObject<HTMLSpanElement>}
        className={cn(className)}
        {...interactiveProps}
      >
        {children}
      </span>
      {hoverTooltip}
      {helpDialog}
    </>
  )
}
