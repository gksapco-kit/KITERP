import type { ReactNode } from 'react'
import type { StyleConfig } from '@/blocks/registry'

/** Friendly builder/preview placeholder when a section has no content yet. */
export default function BlockEmptyPlaceholder({
  title,
  message,
  hint,
  style,
  icon,
}: {
  title: string
  message: string
  hint?: string
  style?: StyleConfig
  icon?: ReactNode
}) {
  const textColor = style?.text_color || '#374151'
  const surface = style?.surface_color || style?.bg_color || '#f9fafb'
  const primary = style?.primary_color || '#6366f1'

  return (
    <section
      className="py-12 sm:py-16 px-6 sm:px-10 max-w-4xl mx-auto"
      style={{ backgroundColor: surface }}
    >
      <div
        className="rounded-2xl border-2 border-dashed px-6 py-10 text-center"
        style={{ borderColor: `${primary}44`, backgroundColor: `${primary}08` }}
      >
        {icon && <div className="mb-4 flex justify-center opacity-60">{icon}</div>}
        <h3
          className="text-lg sm:text-xl font-semibold mb-2"
          style={{ fontFamily: style?.font_heading, color: textColor }}
        >
          {title}
        </h3>
        <p className="text-sm opacity-80 max-w-md mx-auto leading-relaxed" style={{ color: textColor }}>
          {message}
        </p>
        {hint && (
          <p className="text-xs mt-3 opacity-60 max-w-sm mx-auto" style={{ color: textColor }}>
            {hint}
          </p>
        )}
      </div>
    </section>
  )
}
