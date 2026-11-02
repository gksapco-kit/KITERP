import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import {
  SilkAtelierLink,
  SilkAtelierProductCard,
  SilkAtelierScrollRow,
  PillLink,
  asStringList,
  collectionUrl,
  pickItems,
  useSilkAtelierTheme,
  type SilkAtelierCardShape,
} from './shared'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockId?: string
  isEditorCanvas?: boolean
}

/** Editorial product row for one curated collection (e.g. luxury line, "wardrobe" picks). */
export default function SilkAtelierProductCarousel({ style, props, liveItems }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const filters = asStringList(props.category_filter)
  const limit = Math.max(4, Number(props.count) || 12)
  const title = String(props.title || 'Featured')
  const { items, total } = pickItems(liveItems, filters, limit, title)
  const shape = (['arch', 'portrait', 'rounded'].includes(String(props.card_shape)) ? String(props.card_shape) : 'portrait') as SilkAtelierCardShape
  const viewAll = String(props.view_all_url || collectionUrl(filters[0] || title))
  const cardWidth = Math.max(150, Math.min(300, Number(props.card_width) || 240))

  return (
    <section className="w-full" style={{ background: (props.section_bg as string) || '#fff', fontFamily: theme.bodyFont }}>
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl" style={{ color: theme.primary, fontFamily: theme.headingFont }}>
              {props.title_bold ? <strong className="font-bold">{String(props.title_bold)}</strong> : null}
              {props.title_bold && props.title ? <span className="mx-2 opacity-40">|</span> : null}
              <span className="font-normal" style={{ color: theme.highlight }}>{String(props.title || '')}</span>
            </h2>
            {props.tagline ? <p className="mt-2 text-sm italic" style={{ color: theme.primary }}>{String(props.tagline)}</p> : null}
          </div>
          <PillLink to={viewAll} theme={theme}>View all{total > 0 ? ` (${total})` : ''}</PillLink>
        </div>
        <div className="mt-6">
          <SilkAtelierScrollRow theme={theme}>
            {items.map((it) => <SilkAtelierProductCard key={String(it.id)} item={it} theme={theme} shape={shape} width={cardWidth} />)}
          </SilkAtelierScrollRow>
        </div>
        <div className="mt-2 text-center sm:hidden">
          <SilkAtelierLink to={viewAll} className="text-sm font-semibold italic underline" style={{ color: theme.primary }}>See the full collection</SilkAtelierLink>
        </div>
      </div>
    </section>
  )
}
