import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Clock, Lock } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { cn, imgUrl } from '@/lib/utils'
import {
  SilkAtelierLink,
  SilkAtelierDropFeatureCard,
  SilkAtelierDropViewAllCard,
  SilkAtelierProductCard,
  SilkAtelierScrollRow,
  PillLink,
  asObjectList,
  asStringList,
  collectionUrl,
  extraLinkCatalogHref,
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

interface Slot extends Record<string, unknown> {
  /** 24h "HH:MM" or "7:00 AM" style. */
  time?: string
  label?: string
  category_filter?: string[] | string
  url?: string
  feature_image?: string
}
interface ExtraLink extends Record<string, unknown> {
  label?: string
  url?: string
  category_filter?: string[] | string
  feature_image?: string
  /** When true, pill navigates away instead of switching the shelf in-place. */
  open_page?: boolean
}

/** "10:45 AM" / "13:45" → minutes since midnight (null if unparseable). */
function parseMinutes(raw: string | undefined): number | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const ap = m[3]?.toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** "Today's New Arrivals" — daily time-slot drops with a product carousel. */
export default function SilkAtelierDrops({ style, props, liveItems, isEditorCanvas }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const slots = asObjectList<Slot>(props.slots)
  const extras = asObjectList<ExtraLink>(props.extra_links)
  const perSlot = Math.max(4, Number(props.items_per_slot) || 10)
  const unlockSlots = props.unlock_by_time !== false

  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowMinutes()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const states = useMemo(
    () => slots.map((s) => {
      const at = parseMinutes(s.time)
      const live = isEditorCanvas || !unlockSlots || at == null || at <= now
      return { slot: s, live }
    }),
    [slots, now, isEditorCanvas, unlockSlots],
  )

  const latestLive = useMemo(() => {
    let idx = -1
    states.forEach((s, i) => { if (s.live) idx = i })
    return idx < 0 ? 0 : idx
  }, [states])

  const [picked, setPicked] = useState<number | null>(null)
  const [activeExtraIdx, setActiveExtraIdx] = useState<number | null>(null)
  const activeIdx = picked != null && states[picked]?.live ? picked : latestLive
  const active = states[activeIdx]?.slot
  const extraActive = activeExtraIdx != null ? extras[activeExtraIdx] : null
  const extraFilters = extraActive
    ? asStringList(extraActive.category_filter).length
      ? asStringList(extraActive.category_filter)
      : [String(extraActive.label || '').trim()].filter(Boolean)
    : []
  const filters = extraActive ? extraFilters : asStringList(active?.category_filter)
  const label = extraActive
    ? String(extraActive.label || 'Collection')
    : String(active?.label || 'New arrivals')
  const { items, total, isPlaceholder } = pickItems(liveItems, filters.length ? filters : [label], perSlot, label)
  const viewAll = extraActive
    ? extraLinkCatalogHref(String(extraActive.label || ''), String(extraActive.url || ''))
    : String(active?.url || collectionUrl(filters[0] || label, label))
  const carouselItems = items.slice(0, 8)
  const featureImage =
    imgUrl(String((extraActive ? extraActive.feature_image : active?.feature_image) || ''))
    || imgUrl(carouselItems[0]?.image_url)
    || swatchImage(label, 520, 700)
  const designCount = total > 0 ? total : (isPlaceholder ? 0 : carouselItems.length)

  return (
    <section
      className="w-full"
      style={{ background: `linear-gradient(180deg, #FFF9EF 0%, ${theme.cream} 100%)`, fontFamily: theme.bodyFont }}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <div
          data-silk-drops-sticky
          className="sticky top-0 z-40 -mx-4 px-4 pb-3 pt-1 sm:-mx-8 sm:px-8 sm:pb-4"
          style={{
            background: `linear-gradient(180deg, #FFF9EF 0%, ${theme.cream} 88%, ${theme.cream}00 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl" style={{ color: theme.primary, fontFamily: theme.headingFont }}>
                {(props.title_before as string) || "Today's"}{' '}
                <em className="font-normal italic" style={{ color: theme.highlight }}>{(props.title_accent as string) || 'New Arrivals'}</em>
              </h2>
              {props.subtitle ? <p className="mt-1.5 text-sm italic" style={{ color: `${theme.ink}aa` }}>{String(props.subtitle)}</p> : null}
            </div>
            <div className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: theme.primary }}>
              <Clock className="h-4 w-4" aria-hidden />
              {new Date(2000, 0, 1, Math.floor(now / 60), now % 60).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>

          <div className="relative mt-6">
            <div
              className="pointer-events-none absolute left-0 right-0 top-[26px] hidden h-px sm:block"
              style={{ background: `linear-gradient(90deg, transparent, ${theme.accent} 8%, ${theme.accent} 92%, transparent)` }}
              aria-hidden
            />
            <div
              className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Today's drops"
            >
          {states.map(({ slot, live }, i) => {
            const isActive = !extraActive && i === activeIdx
            return (
              <button
                key={`${slot.time}-${i}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={!live}
                onClick={() => {
                  setPicked(i)
                  setActiveExtraIdx(null)
                }}
                className={cn(
                  'relative z-[1] flex shrink-0 flex-col items-start rounded-full px-4 py-2 text-left transition sm:px-5',
                  !live && 'cursor-not-allowed opacity-70',
                )}
                style={
                  isActive
                    ? { background: theme.primary, color: '#fff', border: `2px solid ${theme.primary}` }
                    : { background: '#fff', color: theme.primary, border: `1px solid ${theme.accent}` }
                }
              >
                <span className="text-sm font-bold leading-tight">{slot.time}</span>
                <span className="flex items-center gap-1.5 text-[11px] italic leading-tight opacity-80">
                  {!live && <Lock className="h-3 w-3" aria-hidden />}
                  {String(slot.label || '')}
                </span>
              </button>
            )
          })}
          {extras.map((x, i) => {
            const isExtraActive = activeExtraIdx === i
            const extraHref = extraLinkCatalogHref(String(x.label || ''), String(x.url || ''))
            const openPage = x.open_page === true
            const pillClass = cn(
              'relative z-[1] flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold italic transition sm:px-5 sm:py-3',
              isExtraActive ? 'border-2' : 'border border-dashed',
            )
            const pillStyle = isExtraActive
              ? { borderColor: theme.primary, color: '#fff', background: theme.primary }
              : { borderColor: theme.accent, color: theme.primary, background: '#fff' }

            if (openPage) {
              return (
                <SilkAtelierLink
                  key={`${x.label}-${i}`}
                  to={extraHref}
                  className={pillClass}
                  style={pillStyle}
                >
                  {x.label} <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </SilkAtelierLink>
              )
            }

            return (
              <button
                key={`${x.label}-${i}`}
                type="button"
                role="tab"
                aria-selected={isExtraActive}
                onClick={() => {
                  setActiveExtraIdx(i)
                  setPicked(null)
                }}
                className={pillClass}
                style={pillStyle}
              >
                {x.label}
                {!isExtraActive ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
              </button>
            )
          })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <h3 className="text-xl sm:text-2xl" style={{ color: theme.primary, fontFamily: theme.headingFont }}>
            {label}
          </h3>
          <SilkAtelierLink to={viewAll} className="text-sm font-semibold italic underline underline-offset-4" style={{ color: theme.primary }}>
            View all
          </SilkAtelierLink>
        </div>

        <div className="mt-5">
          <SilkAtelierScrollRow
            theme={theme}
            leading={
              <SilkAtelierDropFeatureCard
                label={label}
                viewAll={viewAll}
                styleCount={designCount}
                imageUrl={featureImage}
                theme={theme}
              />
            }
            trailing={
              <SilkAtelierDropViewAllCard viewAll={viewAll} designCount={designCount} theme={theme} />
            }
          >
            {carouselItems.map((it) => (
              <SilkAtelierProductCard key={String(it.id)} item={it} theme={theme} shape="arch" width={176} />
            ))}
          </SilkAtelierScrollRow>
        </div>

        <div className="mt-4 text-center sm:hidden">
          <PillLink to={viewAll} theme={theme}>View all</PillLink>
        </div>
      </div>
    </section>
  )
}
