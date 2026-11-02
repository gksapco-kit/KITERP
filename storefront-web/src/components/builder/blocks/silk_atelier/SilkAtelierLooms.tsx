import { useState } from 'react'
import { BadgeCheck, MapPin } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl, cn } from '@/lib/utils'
import {
  SilkAtelierLink,
  SilkAtelierProductCard,
  SilkAtelierScrollRow,
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

interface Loom extends Record<string, unknown> {
  name?: string
  state?: string
  thumb_image?: string
  hero_image?: string
  story?: string
  weave?: string
  known_for?: string
  wear_for?: string
  certified?: boolean
  category_filter?: string[] | string
  view_all_url?: string
  /** Optional override for the "N designs" figure (otherwise the live match count). */
  designs_count?: number
}

/** "Heritage Looms" — weaving-tradition tabs with a story panel and live product row. */
export default function SilkAtelierLooms({ style, props, liveItems }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const looms = asObjectList<Loom>(props.looms)
  const perTab = Math.max(4, Number(props.items_per_tab) || 11)
  const [idx, setIdx] = useState(0)
  const loom = looms[Math.min(idx, Math.max(looms.length - 1, 0))]
  const name = String(loom?.name || 'Collection')
  const filters = asStringList(loom?.category_filter)
  const { items, total } = pickItems(liveItems, filters.length ? filters : [name], perTab, name)
  const count = Number(loom?.designs_count) || total
  const viewAll = String(loom?.view_all_url || collectionUrl(filters[0] || name))

  return (
    <section className="w-full bg-white" style={{ fontFamily: theme.bodyFont }}>
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            {props.eyebrow ? (
              <p className="text-[11px] font-medium uppercase italic tracking-[0.28em]" style={{ color: theme.accent }}>{String(props.eyebrow)}</p>
            ) : null}
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl" style={{ color: theme.primary, fontFamily: theme.headingFont }}>
              {String(props.title || 'Heritage Looms')}
            </h2>
            {props.subtitle ? <p className="mt-3 text-[15px] italic" style={{ color: `${theme.ink}bb` }}>{String(props.subtitle)}</p> : null}
          </div>
          {looms.length > 0 && (
            <div className="flex items-baseline gap-3 border-l pl-5" style={{ borderColor: `${theme.accent}55` }}>
              <span className="text-4xl font-light" style={{ color: theme.primary, fontFamily: theme.headingFont }}>{looms.length}</span>
              <span className="text-[11px] uppercase italic tracking-[0.22em]" style={{ color: `${theme.ink}99` }}>Weaving traditions</span>
            </div>
          )}
        </div>

        {looms.length > 0 && (
          <div className="mt-8 grid grid-cols-2 border sm:grid-cols-3 lg:grid-cols-6" style={{ borderColor: `${theme.accent}44` }} role="tablist">
            {looms.map((l, i) => {
              const active = i === idx
              return (
                <button
                  key={`${l.name}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setIdx(i)}
                  className={cn('relative flex items-center gap-3 px-4 py-3 text-left transition', i > 0 && 'border-l')}
                  style={{ borderColor: `${theme.accent}33`, background: active ? '#fff' : '#FBF8F3' }}
                >
                  <img
                    src={imgUrl(l.thumb_image as string) || swatchImage(String(l.name), 96, 96)}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                    style={{ outline: `2px solid ${active ? theme.primary : `${theme.accent}66`}`, outlineOffset: 1 }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold italic" style={{ color: active ? theme.primary : `${theme.ink}cc` }}>{l.name}</span>
                    <span className="block truncate text-[10px] uppercase tracking-[0.14em]" style={{ color: `${theme.ink}88` }}>{l.state}</span>
                  </span>
                  {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: theme.primary }} />}
                </button>
              )
            })}
          </div>
        )}

        {loom && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* Story panel */}
            <div className="overflow-hidden rounded-2xl shadow-xl" style={{ background: theme.primary }}>
              <div className="relative aspect-[4/3] w-full">
                <img
                  src={imgUrl(loom.hero_image as string) || swatchImage(name, 680, 510)}
                  alt={name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(180deg, transparent, ${theme.primary})` }} />
              </div>
              <div className="space-y-4 px-5 pb-6 pt-2 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  {loom.state ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
                      <MapPin className="h-3.5 w-3.5" aria-hidden /> {String(loom.state)}
                    </span>
                  ) : null}
                  {loom.certified !== false && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: `${theme.accent}99` }}>
                      <BadgeCheck className="h-3 w-3" aria-hidden /> {(props.badge_label as string) || 'Silk Mark Certified'}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl" style={{ fontFamily: theme.headingFont }}>{name}</h3>
                {loom.story ? <p className="text-[13px] leading-relaxed text-white/80">{String(loom.story)}</p> : null}
                <dl className="grid grid-cols-1 gap-3 text-[12px]">
                  {([['Weave', loom.weave], ['Known for', loom.known_for], ['Wear it for', loom.wear_for]] as const).map(([k, v]) =>
                    v ? (
                      <div key={k} className="border-t border-white/15 pt-2">
                        <dt className="text-[10px] uppercase tracking-[0.2em]" style={{ color: theme.accent }}>{k}</dt>
                        <dd className="mt-0.5 text-white/90">{String(v)}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                <SilkAtelierLink
                  to={viewAll}
                  className="inline-flex w-full items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold italic transition hover:bg-white/10"
                  style={{ borderColor: `${theme.accent}aa` }}
                >
                  Explore all {count > 0 ? `${count} ` : ''}designs
                </SilkAtelierLink>
              </div>
            </div>

            {/* Product row */}
            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: `${theme.accent}44` }}>
                <p style={{ color: theme.primary }}>
                  <span className="text-xl italic" style={{ fontFamily: theme.headingFont }}>{name}</span>{' '}
                  <span className="text-xs italic opacity-60">
                    {count > 0 ? `Showing ${Math.min(items.length, count)} of ${count}` : 'Fresh designs soon'}
                  </span>
                </p>
                <SilkAtelierLink to={viewAll} className="text-xs font-semibold uppercase tracking-[0.16em] underline underline-offset-4" style={{ color: theme.primary }}>
                  View all →
                </SilkAtelierLink>
              </div>
              <div className="mt-5">
                <SilkAtelierScrollRow theme={theme}>
                  {items.map((it) => <SilkAtelierProductCard key={String(it.id)} item={it} theme={theme} shape="portrait" width={190} />)}
                </SilkAtelierScrollRow>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
