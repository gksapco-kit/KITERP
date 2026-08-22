import type { ReactNode } from 'react'

/** Dark “KIT” half — matches landing header. */
export const KITERP_KIT_COLOR = '#1e3d34'
/** Brand green for the “ERP” half of KITERP (matches landing header). */
export const KITERP_ERP_COLOR = '#3d9a7a'

/**
 * Renders text with KIT ERP two-tone mark: KIT dark, ERP brand green.
 * Standalone “KITERP” becomes “KIT ERP”. “KITERP.com” stays a domain (no space).
 */
export function formatKiterpBrandText(text: string): ReactNode {
  const parts = text.split(/(KITERP)/i)
  if (parts.length === 1) return text

  return parts.map((part, i) => {
    if (!/^KITERP$/i.test(part)) return part
    const next = parts[i + 1] || ''
    const isDomain = next.toLowerCase().startsWith('.com')
    return (
      <span key={i} style={{ color: KITERP_KIT_COLOR }}>
        {part.slice(0, 3)}
        {isDomain ? null : ' '}
        <span style={{ color: KITERP_ERP_COLOR }}>{part.slice(3)}</span>
      </span>
    )
  })
}
