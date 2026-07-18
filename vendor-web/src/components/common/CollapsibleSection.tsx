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
          'flex w-full items-stretch border-b border-transparent',
          open && 'border-border/60 bg-muted/20',
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-3.5 text-left transition-colors sm:px-4',
            'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            headerAction ? 'pr-2' : 'pr-3 sm:pr-4',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              'bg-primary/10 text-primary ring-1 ring-inset ring-primary/15',
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
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
                <span className="truncate text-xs font-normal text-muted-foreground" title={subtitle}>
                  {subtitle}
                </span>
              ) : null}
            </p>
            {helpText ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground/80" title={helpText}>
                {helpText}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {headerAction ? (
          <div
            className="flex shrink-0 items-center self-stretch px-2 sm:px-3"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {headerAction}
          </div>
        ) : null}
        {badge}
      </div>
      {open ? (
        <CardContent className="border-t border-border/80 bg-muted/25 px-3 pb-5 pt-4 sm:px-5">
          {children}
        </CardContent>
      ) : null}
    </Card>
  )
}
