import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl, cn } from '@/lib/utils'
import {
  SilkAtelierLink,
  SilkAtelierProductCard,
  SilkAtelierScrollRow,
  CREAM_PATTERN,
  Eyebrow,
  GradientHeading,
  asObjectList,
  asStringList,
  collectionUrl,
  pickItems,
  swatchImage,
  useSilkAtelierTheme,
} from './shared'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockId?: string
  isEditorCanvas?: boolean
}

interface Brand extends Record<string, unknown> {
  name?: string
  /** Optional wordmark image shown in the tab. */
  logo_image?: string
  designs_label?: string
  category_filter?: string[] | string
  promo_image?: string
  explore_url?: string
}

/** Tabbed premium collection showcase (e.g. "Pure Kanchipuram Silks" with sub-collections). */
export default function SilkAtelierBrandTabs({ style, props, liveItems }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const brands = asObjectList<Brand>(props.brands)
  const chips = asStringList(props.chips)
  const perTab = Math.max(4, Number(props.items_per_tab) || 12)
  const [idx, setIdx] = useState(0)
  const brand = brands[Math.min(idx, Math.max(brands.length - 1, 0))]
  const filters = asStringList(brand?.category_filter)
  const name = String(brand?.name || 'Collection')
  const { items, total } = pickItems(liveItems, filters.length ? filters : [name], perTab, name)
  const exploreUrl = String(brand?.explore_url || collectionUrl(filters[0] || name))
  const designs = String(brand?.designs_label || (total ? `${total}+` : ''))

  return (
    <section className="w-full" style={{ background: theme.cream, ...CREAM_PATTERN, fontFamily: theme.bodyFont }}>
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        {props.eyebrow ? <Eyebrow theme={theme}>{String(props.eyebrow)}</Eyebrow> : null}
        <GradientHeading before={props.title_before as string} accent={props.title_accent as string} after={props.title_after as string} theme={theme} className="mt-3" />
        {props.subtitle ? <p className="mt-3 max-w-2xl text-[15px] italic" style={{ color: `${theme.ink}bb` }}>{String(props.subtitle)}</p> : null}

        {chips.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {chips.map((c) => (
              <li
                key={c}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[11px] font-medium uppercase italic tracking-[0.18em]"
                style={{ border: `1px solid ${theme.accent}55`, color: theme.primary }}
              >
                <Sparkles className="h-3 w-3" style={{ color: theme.accent }} aria-hidden /> {c}
              </li>
            ))}
          </ul>
        )}

        {brands.length > 0 && (
          <div className="mt-8 flex overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderColor: `${theme.accent}44` }} role="tablist">
            {brands.map((b, i) => {
              const active = i === idx
              const count = String(b.designs_label || '')
              return (
                <button
                  key={`${b.name}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setIdx(i)}
                  className={cn('relative shrink-0 px-6 pb-4 pt-2 text-left transition', i > 0 && 'border-l')}
                  style={{ borderColor: `${theme.accent}33`, opacity: active ? 1 : 0.55 }}
                >
                  {b.logo_image ? (
                    <img src={imgUrl(b.logo_image as string)} alt={String(b.name || '')} className="h-9 w-auto max-w-[160px] object-contain" />
                  ) : (
                    <span className="block text-xl italic" style={{ color: theme.primary, fontFamily: theme.headingFont }}>{b.name}</span>
                  )}
                  {count ? (
                    <span className="mt-1 block text-sm" style={{ color: theme.primary }}>
                      <strong>{count}</strong> <em className="opacity-70">designs</em>
                    </span>
                  ) : null}
                  {active && <span aria-hidden className="absolute inset-x-6 -bottom-px h-[2px]" style={{ background: theme.primary }} />}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-8">
          <SilkAtelierScrollRow
            theme={theme}
            leading={
              <SilkAtelierLink
                to={exploreUrl}
                className="group relative flex shrink-0 snap-start flex-col justify-end overflow-hidden"
                style={{ width: 190, minHeight: 330, borderRadius: '999px 999px 18px 18px', background: theme.primary, boxShadow: '0 14px 28px -16px rgba(90,11,58,.7)' }}
              >
                <img
                  src={imgUrl(brand?.promo_image as string) || swatchImage(name, 380, 660)}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
                />
                <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 35%, ${theme.primary}ee 100%)`, boxShadow: `inset 0 0 0 1px ${theme.accent}77` }} />
                <span className="relative z-10 px-4 pb-6 text-center text-white">
                  {designs ? <span className="block text-[11px] uppercase tracking-[0.22em]" style={{ color: theme.accent }}>{designs} designs</span> : null}
                  <span className="mt-1 block text-xl italic" style={{ fontFamily: theme.headingFont }}>{name}</span>
                  <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[11px] font-semibold uppercase italic tracking-[0.2em]" style={{ color: theme.primary }}>
                    Explore <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </span>
              </SilkAtelierLink>
            }
          >
            {items.map((it) => <SilkAtelierProductCard key={String(it.id)} item={it} theme={theme} shape="rounded" width={200} />)}
          </SilkAtelierScrollRow>
        </div>
      </div>
    </section>
  )
}
