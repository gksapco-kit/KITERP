import type { ReactNode } from 'react'
import type { StyleConfig } from '@/blocks/registry'

/** Friendly builder/preview placeholder when a section has no content yet. */
export default function BlockEmptyPlaceholder({
  title,
  message,
  hint,
  style,
  icon,
  actionHref,
  actionLabel,
}: {
  title?: string
  message: string
  hint?: string
  style?: StyleConfig
  icon?: ReactNode
  /** Optional dashboard deep-link (e.g. create product). */
  actionHref?: string
  actionLabel?: string
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
        {title ? (
          <h3
            className="text-lg sm:text-xl font-semibold mb-2"
            style={{ fontFamily: style?.font_heading, color: textColor }}
          >
            {title}
          </h3>
        ) : null}
        <p className="text-sm opacity-80 max-w-md mx-auto leading-relaxed" style={{ color: textColor }}>
          {message}
        </p>
        {hint && (
          <p className="text-xs mt-3 opacity-60 max-w-sm mx-auto" style={{ color: textColor }}>
            {hint}
          </p>
        )}
        {actionHref && actionLabel ? (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center mt-5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primary }}
          >
            {actionLabel}
          </a>
        ) : null}
      </div>
    </section>
  )
}
