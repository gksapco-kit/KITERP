import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'
import {
  SilkAtelierLink,
  SilkAtelierScrollRow,
  CREAM_PATTERN,
  PillLink,
  asObjectList,
  swatchImage,
  useSilkAtelierTheme,
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

interface Tile extends Record<string, unknown> {
  title?: string
  subtitle?: string
  image_url?: string
  url?: string
}
interface Section extends Record<string, unknown> {
  heading?: string
  items?: Tile[]
}

type TileShape = 'arch' | 'poster' | 'round' | 'card'

function TileCard({ tile, shape, theme, index }: { tile: Tile; shape: TileShape; theme: SilkAtelierTheme; index: number }) {
  const title = String(tile.title || '')
  const img = imgUrl(tile.image_url as string) || swatchImage(`${title}-${index}`, 480, shape === 'poster' ? 600 : 560)
  const radius = shape === 'arch' ? '999px 999px 18px 18px' : shape === 'round' ? '999px' : shape === 'poster' ? '14px' : '16px'
  return (
    <SilkAtelierLink to={String(tile.url || '/products')} className="group block text-center">
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          aspectRatio: shape === 'round' ? '1 / 1' : shape === 'poster' ? '4 / 5' : '3 / 3.6',
          borderRadius: radius,
          background: '#2a1620',
          boxShadow: '0 12px 26px -16px rgba(90,11,58,.6)',
          outline: shape === 'arch' ? `1px solid ${theme.accent}66` : undefined,
          outlineOffset: shape === 'arch' ? '-6px' : undefined,
        }}
      >
        <img src={img} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {shape === 'poster' && title ? (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.55))' }} />
        ) : null}
      </div>
      {title ? (
        <p className="mt-3 text-[17px] italic leading-snug" style={{ color: theme.primary, fontFamily: theme.headingFont }}>{title}</p>
      ) : null}
      {tile.subtitle ? (
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em]" style={{ color: theme.accent }}>{String(tile.subtitle)}</p>
      ) : null}
    </SilkAtelierLink>
  )
}

/**
 * Generic collection tiles — arch / poster / round / card images with title +
 * "N designs" subtitle, optionally grouped under divider headings.
 * Used for sub-brand ranges, curations, "shop by weave" rows, etc.
 */
export default function SilkAtelierTiles({ style, props }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const shape = (['arch', 'poster', 'round', 'card'].includes(String(props.shape)) ? String(props.shape) : 'arch') as TileShape
  const sections = asObjectList<Section>(props.sections)
  const columns = Math.min(6, Math.max(2, Number(props.columns) || 4))
  const scroll = props.layout === 'scroll'
  const dark = props.bg_style === 'dark'
  const bg = (props.section_bg as string) || (dark ? theme.primary : theme.cream)

  return (
    <section
      className="w-full"
      style={{ background: bg, ...(dark ? {} : CREAM_PATTERN), fontFamily: theme.bodyFont, color: dark ? '#fff' : theme.ink }}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <header className="text-center">
          {props.logo_image ? (
            <img src={imgUrl(props.logo_image as string)} alt={String(props.title || '')} className="mx-auto h-16 w-auto object-contain" />
          ) : props.title ? (
            <h2 className="text-3xl sm:text-4xl" style={{ color: dark ? '#fff' : theme.primary, fontFamily: theme.headingFont }}>
              {props.title_bold ? <strong className="font-semibold">{String(props.title_bold)} </strong> : null}
              {String(props.title)}
            </h2>
          ) : null}
          {props.subtitle ? (
            <p className="mx-auto mt-3 max-w-xl text-[15px] italic" style={{ color: dark ? 'rgba(255,255,255,.8)' : `${theme.ink}bb` }}>{String(props.subtitle)}</p>
          ) : null}
        </header>

        <div className="mt-8 space-y-10">
          {sections.map((sec, si) => {
            const tiles = asObjectList<Tile>(sec.items)
            return (
              <div key={`${sec.heading}-${si}`}>
                {sec.heading ? (
                  <div className="mb-6 flex items-center gap-4">
                    <span aria-hidden className="h-px flex-1" style={{ background: `${theme.accent}77` }} />
                    <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: dark ? theme.accent : theme.primary }}>
                      <span aria-hidden style={{ color: theme.accent }}>◆</span>
                      {sec.heading}
                    </span>
                    <span aria-hidden className="h-px flex-1" style={{ background: `${theme.accent}77` }} />
                  </div>
                ) : null}
                {scroll ? (
                  <SilkAtelierScrollRow theme={theme}>
                    {tiles.map((t, ti) => (
                      <div key={`${t.title}-${ti}`} className="w-[220px] shrink-0 snap-start sm:w-[250px]">
                        <TileCard tile={t} shape={shape} theme={theme} index={ti} />
                      </div>
                    ))}
                  </SilkAtelierScrollRow>
                ) : (
                  <div className="grid gap-x-5 gap-y-8" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columns >= 5 ? 150 : 200}px, 1fr))` }}>
                    {tiles.map((t, ti) => <TileCard key={`${t.title}-${ti}`} tile={t} shape={shape} theme={theme} index={ti} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {props.cta_label ? (
          <div className="mt-10 text-center">
            <PillLink to={String(props.cta_url || '/products')} theme={theme} solid={!dark}>{String(props.cta_label)}</PillLink>
          </div>
        ) : null}
      </div>
    </section>
  )
}
