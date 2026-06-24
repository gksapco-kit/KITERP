import type { ElementType, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { HelpableText } from '@/components/common/HelpableText'
import { cn } from '@/lib/utils'

export interface CollapsibleSectionProps {
  title: string
  icon: ElementType
  subtitle?: string
  /** Second line below subtitle — visible summary (hover/F1 help is on the title). */
  helpText?: string
  /** Registry key for title hover + F1 help (e.g. "message center:new orders"). */
  helpKey?: string
  hoverHint?: string
  fullHelp?: string
  footerNote?: string
  open: boolean
  toggle: () => void
  children: ReactNode
  badge?: ReactNode
  /** Controls rendered in the header row (e.g. Yes/No) — clicks do not toggle the section. */
  headerAction?: ReactNode
}

/** Shared accordion section — matches Settings page styling (dark-mode safe). */
export function CollapsibleSection({
  title,
  icon: Icon,
  subtitle,
  helpText,
  helpKey,
  hoverHint,
  fullHelp,
  footerNote,
  open,
  toggle,
  children,
  badge,
  headerAction,
}: CollapsibleSectionProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-sm transition-[box-shadow,border-color,background-color] duration-200',
        open
          ? 'border-primary/35 shadow-md ring-1 ring-primary/15'
          : 'border-border/80 hover:border-primary/25 hover:shadow-md',
      )}
    >
      <div
        className={cn(
          'flex w-full items-center gap-1 border-b border-transparent sm:gap-2',
          open && 'border-border/60 bg-muted/20',
        )}
      >
        <div className="relative flex min-w-0 flex-1 items-center gap-3 px-3 py-3.5 sm:px-4">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            className="absolute inset-0 z-0 rounded-none text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
          <span
            className={cn(
              'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              'bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 pointer-events-none',
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
          </span>
          <div className="relative z-10 min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 leading-snug">
              <HelpableText
                helpKey={helpKey ?? title}
                hoverHint={hoverHint}
                fullHelp={fullHelp}
                footerNote={footerNote}
                className="text-sm font-semibold text-foreground"
              >
                {title}
              </HelpableText>
              {subtitle ? (
                <span className="truncate text-xs font-normal text-muted-foreground pointer-events-none" title={subtitle}>
                  {subtitle}
                </span>
              ) : null}
            </p>
            {helpText ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground/80 pointer-events-none" title={helpText}>
                {helpText}
              </p>
            ) : null}
          </div>
        </div>
        {headerAction ? (
          <div
            className="shrink-0 self-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {headerAction}
          </div>
        ) : null}
        {badge}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Collapse section' : 'Expand section'}
          className="shrink-0 px-3 py-3.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <CardContent className="border-t border-border/80 bg-muted/25 px-3 pb-5 pt-4 sm:px-5">
          {children}
        </CardContent>
      ) : null}
    </Card>
  )
}
