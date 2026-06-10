import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
    <section
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden',
        className,
      )}
    >
      <header className="px-3 py-2.5 border-b border-gray-100 bg-gradient-to-b from-gray-50/90 to-gray-50/40">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{title}</h3>
        {description ? (
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{description}</p>
        ) : null}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}
