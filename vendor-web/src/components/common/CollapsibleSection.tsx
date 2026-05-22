import type { ElementType, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface CollapsibleSectionProps {
  title: string
  icon: ElementType
  subtitle?: string
  open: boolean
  toggle: () => void
  children: ReactNode
  badge?: ReactNode
}

/** Shared accordion section — matches Settings page styling (dark-mode safe). */
export function CollapsibleSection({
  title,
  icon: Icon,
  subtitle,
  open,
  toggle,
  children,
  badge,
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
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 border-b border-transparent px-3 py-3.5 text-left transition-colors sm:px-4',
          open && 'border-border/60 bg-muted/20',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
          <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <CardContent className="border-t border-border/80 bg-muted/25 px-3 pb-5 pt-4 sm:px-5">
          {children}
        </CardContent>
      ) : null}
    </Card>
  )
}
