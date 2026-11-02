import { Link } from 'react-router-dom'

export type PriceBand = {
  key: string
  label: string
  count: number
  /** inclusive lower bound (rupees) */
  min?: number
  /** inclusive upper bound (rupees) */
  max?: number
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/**
 * Split a list of prices into up to four ranges ("Under ₹x", "₹x – ₹y", …, "Above ₹z")
 * using quartile cut points rounded to a friendly step. Returns [] when there are too few prices.
 */
export function buildPriceBands(prices: number[]): PriceBand[] {
  const ps = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (ps.length < 2) return []
  if (ps.length < 4) {
    const mid = ps[Math.floor(ps.length / 2)]
    const step = mid >= 1000 ? 100 : mid >= 100 ? 10 : 1
    const cut = Math.round(mid / step) * step
    const lo = ps.filter((p) => p <= cut)
    const hi = ps.filter((p) => p > cut)
    if (!lo.length || !hi.length) return []
    return [
      { key: 'b0', label: `Under ${inr(cut)}`, max: cut - 0.01, count: lo.length },
      { key: 'b1', label: `${inr(cut)} & above`, min: cut, count: hi.length },
    ]
  }
  const top = ps[ps.length - 1]
  const step = top >= 10000 ? 1000 : top >= 1000 ? 100 : top >= 100 ? 10 : 1
  const at = (f: number) => Math.round(ps[Math.floor((ps.length - 1) * f)] / step) * step
  const cuts = Array.from(new Set([at(0.25), at(0.5), at(0.75)])).filter((c) => c > ps[0] && c <= top)
  if (!cuts.length) return []

  const bands: PriceBand[] = []
  const inBand = (lo: number | undefined, hi: number | undefined) =>
    ps.filter((p) => (lo == null || p >= lo) && (hi == null || p <= hi)).length

  bands.push({ key: 'b0', label: `Under ${inr(cuts[0])}`, max: cuts[0] - 0.01, count: inBand(undefined, cuts[0] - 0.01) })
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const lo = cuts[i]
    const hi = cuts[i + 1] - 0.01
    bands.push({ key: `b${i + 1}`, label: `${inr(lo)} – ${inr(cuts[i + 1])}`, min: lo, max: hi, count: inBand(lo, hi) })
  }
  const last = cuts[cuts.length - 1]
  bands.push({ key: `b${cuts.length}`, label: `${inr(last)} & above`, min: last, count: inBand(last, undefined) })
  return bands.filter((b) => b.count > 0)
}

const ZIGZAG = (accent: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='14' viewBox='0 0 30 14'><path d='M0 14 L15 0 L30 14 Z' fill='${accent}'/></svg>`,
  )}")`

/** Collection banner shown on /products when the site opts in with style_config.catalog_header = 'silk_atelier'. */
export function SilkAtelierCollectionHeader({
  title,
  count,
  bands,
  activeBandKey,
  onPickBand,
  homeHref,
  parentCrumb,
  primary,
  accent,
  headingFont,
  bodyFont,
}: {
  title: string
  count: number
  bands: PriceBand[]
  activeBandKey: string | null
  onPickBand: (band: PriceBand | null) => void
  homeHref: string
  /** Optional middle crumb — e.g. mega-menu parent when viewing a sub-link collection. */
  parentCrumb?: { label: string; href: string } | null
  primary: string
  accent: string
  headingFont?: string
  bodyFont?: string
}) {
  const serif = headingFont ? `"${headingFont}", Georgia, serif` : 'Georgia, serif'
  const sans = bodyFont ? `"${bodyFont}", system-ui, sans-serif` : 'system-ui, sans-serif'
  const chip = (active: boolean): React.CSSProperties => ({
    borderColor: 'rgba(255,255,255,0.35)',
    background: active ? '#fff' : 'rgba(0,0,0,0.18)',
    color: active ? primary : '#fff',
  })

  return (
    <section className="relative w-full" style={{ background: primary, color: '#fff' }} data-testid="collection-header">
      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-7 sm:px-8">
        <nav
          className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] uppercase tracking-[0.2em] text-white/70"
          style={{ fontFamily: sans }}
          aria-label="Breadcrumb"
        >
          <Link to={homeHref} className="cursor-pointer no-underline hover:text-white hover:no-underline">
            Home
          </Link>
          {parentCrumb && parentCrumb.label.trim() && parentCrumb.label.trim() !== title.trim() ? (
            <>
              <span aria-hidden>›</span>
              <Link
                to={parentCrumb.href}
                className="max-w-[min(100%,14rem)] cursor-pointer truncate no-underline hover:text-white hover:no-underline"
              >
                {parentCrumb.label}
              </Link>
            </>
          ) : null}
          <span aria-hidden>›</span>
          <span className="max-w-[min(100%,20rem)] truncate text-white/90">{title}</span>
        </nav>
        <h1 className="mt-3 text-3xl font-normal leading-tight sm:text-[2.75rem] sm:leading-[1.1]" style={{ fontFamily: sans }}>
          {title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/15 pt-4" style={{ fontFamily: sans }}>
          {bands.length > 0 && (
            <>
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">Price</span>
              {bands.map((b) => {
                const active = b.key === activeBandKey
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => onPickBand(active ? null : b)}
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                    style={chip(active)}
                    aria-pressed={active}
                  >
                    {b.label}
                    <span
                      className="rounded-full px-1.5 text-[10px] font-semibold"
                      style={{ background: active ? `${primary}22` : 'rgba(255,255,255,0.18)' }}
                    >
                      {b.count}
                    </span>
                  </button>
                )
              })}
            </>
          )}
          <span className="ml-auto text-sm italic text-white/90" style={{ fontFamily: serif }}>
            <strong className="font-semibold not-italic" style={{ color: accent }}>{count}</strong>{' '}
            {count === 1 ? 'piece' : 'pieces'}
          </span>
        </div>
      </div>
      {/* gold zigzag border along the bottom edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[14px]"
        style={{ backgroundImage: ZIGZAG(accent), backgroundRepeat: 'repeat-x', backgroundSize: '30px 14px', backgroundPosition: 'left bottom' }}
      />
    </section>
  )
}
