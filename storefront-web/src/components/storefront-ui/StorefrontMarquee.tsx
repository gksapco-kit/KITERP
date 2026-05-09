import type { CSSProperties } from 'react'

/**
 * Marquee ticker from the storefront UI kit (storefront-ui.zip).
 */
type MarqueeVariant = 'retail' | 'resto' | 'hosp'

export function StorefrontMarquee({
  items,
  variant = 'retail',
  className = '',
  durationSec = 30,
}: {
  items: string[]
  variant?: MarqueeVariant
  className?: string
  /** Full loop duration (duplicated track halves effective repeat). */
  durationSec?: number
}) {
  const textCls =
    variant === 'resto' ? 'text-resto-ink' : variant === 'hosp' ? 'text-hosp-ink' : 'text-retail-ink'

  return (
    <div className={`marquee-mask overflow-hidden ${className}`}>
      <div
        className="ticker flex gap-12 whitespace-nowrap w-max"
        style={{ '--ticker-duration': `${durationSec}s` } as CSSProperties}
      >
        {[...items, ...items].map((t, i) => (
          <span
            key={i}
            className={`font-display text-2xl md:text-4xl flex items-center gap-12 opacity-90 ${textCls}`}
          >
            {t} <span className="opacity-40">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
