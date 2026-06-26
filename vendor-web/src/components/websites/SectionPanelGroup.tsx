import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { builderPanelUi } from '@/components/websites/builderPanelUi'

/** Visual section card for Section Edit panel — clear grouping vs flat collapsibles. */
export function SectionPanelGroup({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(builderPanelUi.cardSurface, 'overflow-hidden', className)}>
      <header className="border-b border-border bg-muted/35 px-2.5 py-2">
        <h3 className={builderPanelUi.groupTitle}>{title}</h3>
        {description ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">{description}</p> : null}
      </header>
      <div className="@container p-2">{children}</div>
    </section>
  )
}
