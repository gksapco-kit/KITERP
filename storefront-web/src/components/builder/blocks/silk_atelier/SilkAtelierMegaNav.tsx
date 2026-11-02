import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl, cn } from '@/lib/utils'
import {
  SilkAtelierLink,
  asObjectList,
  swatchImage,
  useSilkAtelierTheme,
  withCollectionTitle,
  type SilkAtelierTheme,
} from './shared'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockId?: string
  isEditorCanvas?: boolean
}

interface LinkItem extends Record<string, unknown> {
  label?: string
  url?: string
}
interface Column extends Record<string, unknown> {
  title?: string
  url?: string
  links?: LinkItem[]
}
interface Tile extends Record<string, unknown> {
  label?: string
  url?: string
  image_url?: string
}
interface MenuItem extends Record<string, unknown> {
  label?: string
  url?: string
  /** 'columns' = grouped text links, 'tiles' = image tile grid. */
  layout?: 'columns' | 'tiles'
  columns?: Column[]
  tiles?: Tile[]
  panel_title?: string
  feature_image?: string
  feature_url?: string
  /** Optional “All … →” label under the first column (defaults to menu label). */
  footer_link_label?: string
}

const MEGA_LINK_COLOR = '#4a4448'

function MegaMenuColumnsPanel({
  columns,
  menuItem,
  theme,
  onNavigate,
}: {
  columns: Column[]
  menuItem: MenuItem
  theme: SilkAtelierTheme
  onNavigate: () => void
}) {
  const featureSrc = menuItem.feature_image ? imgUrl(menuItem.feature_image as string) : ''
  const hasFeature = Boolean(featureSrc)
  const footerLabel = (menuItem.footer_link_label as string)?.trim() || `All ${menuItem.label || 'collections'}`

  return (
    <div
      className={cn(
        'flex w-full items-stretch gap-0',
        hasFeature && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,46%)] lg:items-center lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] xl:gap-10',
      )}
    >
      <div className="flex min-w-0 flex-1">
        {columns.map((col, ci) => (
          <div
            key={`${col.title}-${ci}`}
            className={cn(
              'flex min-w-[9rem] flex-1 flex-col py-1',
              ci > 0 && 'border-l border-[rgba(90,11,58,0.1)]',
              ci === 0 ? 'pr-5 sm:pr-6' : 'px-5 sm:px-6',
            )}
          >
            {col.title ? (
              col.url ? (
                <SilkAtelierLink
                  to={withCollectionTitle(String(col.url), String(col.title || ''), {
                    menu: String(menuItem.label || ''),
                    menuUrl: String(menuItem.url || ''),
                  })}
                  className="mb-3 block cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] antialiased no-underline hover:no-underline"
                  style={{ color: theme.accent, fontFamily: theme.bodyFont }}
                  onClick={onNavigate}
                >
                  {col.title}
                </SilkAtelierLink>
              ) : (
                <p
                  className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] antialiased"
                  style={{ color: theme.accent, fontFamily: theme.bodyFont }}
                >
                  {col.title}
                </p>
              )
            ) : null}
            <ul className="space-y-2">
              {asObjectList<LinkItem>(col.links).map((l, li) => (
                <li key={`${l.label}-${li}`}>
                  <SilkAtelierLink
                    to={withCollectionTitle(String(l.url || menuItem.url || '/products'), String(l.label || ''), {
                      menu: String(menuItem.label || ''),
                      menuUrl: String(menuItem.url || ''),
                    })}
                    className="cursor-pointer text-[13px] font-normal leading-snug antialiased no-underline transition hover:no-underline hover:opacity-75"
                    style={{ color: MEGA_LINK_COLOR, fontFamily: theme.bodyFont }}
                    onClick={onNavigate}
                  >
                    {l.label}
                  </SilkAtelierLink>
                </li>
              ))}
            </ul>
            {ci === 0 && menuItem.url ? (
              <SilkAtelierLink
                to={withCollectionTitle(String(menuItem.url), footerLabel)}
                className="mt-6 cursor-pointer text-[13px] font-semibold antialiased no-underline hover:no-underline hover:opacity-80"
                style={{ color: theme.primary, fontFamily: theme.bodyFont }}
                onClick={onNavigate}
              >
                {footerLabel} →
              </SilkAtelierLink>
            ) : null}
          </div>
        ))}
      </div>
      {hasFeature ? (
        <div className="hidden min-w-0 lg:block lg:py-1 lg:pr-1">
          <SilkAtelierLink
            to={withCollectionTitle(
              String(menuItem.feature_url || menuItem.url || '/products'),
              String(menuItem.label || footerLabel),
            )}
            className="block w-full cursor-pointer overflow-hidden rounded-xl no-underline shadow-[0_4px_24px_rgba(45,20,35,0.08)] hover:no-underline"
            onClick={onNavigate}
          >
            <img
              src={featureSrc}
              alt=""
              loading="lazy"
              className="aspect-[16/10] w-full max-h-[min(52vh,340px)] object-cover object-[center_20%] xl:max-h-[360px]"
            />
          </SilkAtelierLink>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Category bar with desktop mega-menus (text columns or image tiles) and a
 * slide-in mobile drawer — mirrors a boutique saree store header.
 */
export default function SilkAtelierMegaNav({ style, props, isEditorCanvas }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const items = asObjectList<MenuItem>(props.items)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [drawerOpenIdx, setDrawerOpenIdx] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  const barBg = (props.bar_bg as string) || '#FFFFFF'
  const barText = (props.bar_text as string) || theme.primary
  const panelBg = (props.panel_bg as string) || '#F6F3EE'
  const barHeightPx = Math.max(36, Math.min(52, Number(props.bar_height) || 44))

  useEffect(() => {
    const onDoc = (e: globalThis.MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenIdx(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenIdx(null)
        setDrawer(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!drawer) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawer])

  const hasPanel = (m: MenuItem) => asObjectList<Column>(m.columns).length > 0 || asObjectList<Tile>(m.tiles).length > 0

  const openWithIntent = (i: number) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpenIdx(i)
  }
  const closeWithDelay = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenIdx(null), 220)
  }

  const open = openIdx != null ? items[openIdx] : null
  const openColumns = open ? asObjectList<Column>(open.columns) : []
  const openTiles = open ? asObjectList<Tile>(open.tiles) : []

  return (
    <div
      ref={wrapRef}
      data-silk-mega-nav
      className="relative w-full shrink-0 overflow-visible border-b border-black/[0.06] leading-none"
      style={{ background: barBg, fontFamily: theme.bodyFont }}
    >
      {/* Mobile bar */}
      <div className="flex h-9 items-center justify-between px-4 lg:hidden" style={{ borderBottom: `1px solid ${theme.accent}33` }}>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: barText, fontFamily: theme.bodyFont }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" /> {(props.mobile_label as string) || 'Browse collections'}
        </button>
        {items[0]?.url ? (
          <SilkAtelierLink to={String(items[0].url)} className="text-sm font-medium" style={{ color: theme.highlight, fontFamily: theme.bodyFont }}>
            {items[0].label}
          </SilkAtelierLink>
        ) : null}
      </div>

      {/* Desktop bar */}
      <nav
        className="mx-auto hidden max-w-[1400px] flex-nowrap items-center justify-start gap-x-0 overflow-x-auto px-3 lg:flex xl:justify-center xl:gap-x-1 xl:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: barHeightPx, minHeight: barHeightPx }}
        aria-label="Collections"
      >
        {items.map((m, i) => {
          const withPanel = hasPanel(m)
          const active = openIdx === i
          return (
            <div key={`${m.label}-${i}`} className="relative" onMouseEnter={() => (withPanel ? openWithIntent(i) : undefined)} onMouseLeave={closeWithDelay}>
              {withPanel ? (
                <button
                  type="button"
                  onClick={() => setOpenIdx(active ? null : i)}
                  aria-expanded={active}
                  className="inline-flex h-full cursor-pointer items-center gap-0.5 whitespace-nowrap px-2.5 text-[13px] font-medium leading-none tracking-[0.01em] no-underline transition hover:no-underline xl:px-3"
                  style={{ color: active ? theme.highlight : barText, fontFamily: theme.bodyFont }}
                >
                  {m.label}
                  <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-70 transition-transform', active && 'rotate-180')} />
                </button>
              ) : (
                <SilkAtelierLink
                  to={withCollectionTitle(String(m.url || '/products'), String(m.label || ''))}
                  className="inline-flex h-full cursor-pointer items-center whitespace-nowrap px-2.5 text-[13px] font-medium leading-none tracking-[0.01em] no-underline transition hover:opacity-70 hover:no-underline xl:px-3"
                  style={{ color: barText, fontFamily: theme.bodyFont }}
                >
                  {m.label}
                </SilkAtelierLink>
              )}
            </div>
          )
        })}
      </nav>

      {/* Desktop mega panel */}
      {open && hasPanel(open) && (
        <div
          className="absolute left-0 right-0 top-full z-40 hidden border-t border-black/[0.06] shadow-[0_16px_48px_rgba(45,20,35,0.14)] lg:block"
          style={{ background: panelBg }}
          onMouseEnter={() => closeTimer.current && window.clearTimeout(closeTimer.current)}
          onMouseLeave={closeWithDelay}
        >
          <div className="mx-auto max-w-[1440px] px-6 py-8 sm:px-8 lg:py-9" data-silk-mega-panel>
            {open.layout === 'tiles' || (openTiles.length > 0 && openColumns.length === 0) ? (
              <div>
                {open.panel_title ? (
                  <h3 className="mb-5 text-xl" style={{ color: theme.primary, fontFamily: theme.headingFont }}>{open.panel_title}</h3>
                ) : null}
                <div className="grid grid-cols-4 gap-x-5 gap-y-6 xl:grid-cols-6">
                  {openTiles.map((t, ti) => (
                    <SilkAtelierLink
                      key={`${t.label}-${ti}`}
                      to={withCollectionTitle(String(t.url || open.url || '/products'), String(t.label || ''))}
                      className="group block"
                      onClick={() => setOpenIdx(null)}
                    >
                      <div className="aspect-square overflow-hidden rounded-xl" style={{ background: '#2a1620' }}>
                        <img
                          src={imgUrl(t.image_url as string) || swatchImage(String(t.label || ti), 400, 400)}
                          alt={String(t.label || '')}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <p className="mt-2 text-[13px] font-medium leading-snug antialiased" style={{ color: theme.primary, fontFamily: theme.bodyFont }}>{t.label} ›</p>
                    </SilkAtelierLink>
                  ))}
                </div>
              </div>
            ) : (
              <MegaMenuColumnsPanel
                columns={openColumns}
                menuItem={open}
                theme={theme}
                onNavigate={() => setOpenIdx(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col shadow-2xl" style={{ background: '#F6F3EE' }}>
            <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: theme.primary }}>
              <span className="text-lg font-semibold">Menu</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.map((m, i) => {
                const withPanel = hasPanel(m)
                const expanded = drawerOpenIdx === i
                const cols = asObjectList<Column>(m.columns)
                const tiles = asObjectList<Tile>(m.tiles)
                return (
                  <div key={`${m.label}-${i}`} style={{ borderBottom: `1px solid ${theme.accent}33` }}>
                    {withPanel ? (
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[15px] font-medium"
                        style={{ color: theme.primary, fontFamily: theme.bodyFont }}
                        onClick={() => setDrawerOpenIdx(expanded ? null : i)}
                        aria-expanded={expanded}
                      >
                        {m.label}
                        <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
                      </button>
                    ) : (
                      <SilkAtelierLink
                        to={withCollectionTitle(String(m.url || '/products'), String(m.label || ''))}
                        className="block px-5 py-3.5 text-[15px] font-medium"
                        style={{ color: theme.primary, fontFamily: theme.bodyFont }}
                        onClick={() => setDrawer(false)}
                      >
                        {m.label}
                      </SilkAtelierLink>
                    )}
                    {withPanel && expanded && (
                      <div className="space-y-3 bg-white/60 px-5 pb-4 pt-1">
                        <SilkAtelierLink
                          to={withCollectionTitle(String(m.url || '/products'), String(m.label || ''))}
                          className="block cursor-pointer text-[13px] font-semibold no-underline hover:no-underline hover:opacity-80"
                          style={{ color: theme.highlight, fontFamily: theme.bodyFont }}
                          onClick={() => setDrawer(false)}
                        >
                          View all {m.label}
                        </SilkAtelierLink>
                        {cols.map((col, ci) => (
                          <div key={`${col.title}-${ci}`}>
                            {col.title ? (
                              <p
                                className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] antialiased"
                                style={{ color: theme.primary, fontFamily: theme.bodyFont }}
                              >
                                {col.title}
                              </p>
                            ) : null}
                            <ul className="space-y-1.5">
                              {asObjectList<LinkItem>(col.links).map((l, li) => (
                                <li key={`${l.label}-${li}`}>
                                  <SilkAtelierLink
                                    to={withCollectionTitle(String(l.url || m.url || '/products'), String(l.label || ''), {
                                      menu: String(m.label || ''),
                                      menuUrl: String(m.url || ''),
                                    })}
                                    className="cursor-pointer text-[14px] font-medium antialiased no-underline hover:no-underline hover:opacity-80"
                                    style={{ color: theme.primary, fontFamily: theme.bodyFont }}
                                    onClick={() => setDrawer(false)}
                                  >
                                    {l.label}
                                  </SilkAtelierLink>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {tiles.length > 0 && (
                          <ul className="space-y-1.5">
                            {tiles.map((t, ti) => (
                              <li key={`${t.label}-${ti}`}>
                                <SilkAtelierLink
                                  to={withCollectionTitle(String(t.url || m.url || '/products'), String(t.label || ''))}
                                  className="cursor-pointer text-[14px] font-medium antialiased no-underline hover:no-underline hover:opacity-80"
                                  style={{ color: theme.primary, fontFamily: theme.bodyFont }}
                                  onClick={() => setDrawer(false)}
                                >
                                  {t.label}
                                </SilkAtelierLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isEditorCanvas && items.length === 0 ? (
        <p className="px-4 py-3 text-center text-xs text-gray-500">Add menu items in the block data (items → label / url / columns / tiles).</p>
      ) : null}
    </div>
  )
}
