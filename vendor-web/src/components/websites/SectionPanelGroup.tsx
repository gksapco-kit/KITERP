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
      <header className={builderPanelUi.groupHeader}>
        <h3 className={builderPanelUi.groupTitle}>{title}</h3>
        {description ? <p className={builderPanelUi.groupDesc}>{description}</p> : null}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}
