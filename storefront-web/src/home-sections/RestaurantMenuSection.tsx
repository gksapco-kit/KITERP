import { Loader2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { HomeSectionTheme, HomeSectionThemeColors, SectionProps } from './types'
import { accentInText, editorialKitFromTemplate, fieldTypographyStyle, SectionNavLink, storefrontHref, str } from './utils'

/** Allow only hex colours from builder (no arbitrary CSS). */
function safeSectionColor(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return undefined
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ? s : undefined
}

function verdeKickerSizeClass(v: string): string {
  if (v === 'xs') return 'text-[11px]'
  if (v === 'sm') return 'text-sm'
  if (v === 'base') return 'text-base'
  if (v === 'lg') return 'text-lg'
  return 'text-xs'
}

function verdeHeadlineSizeClass(v: string): string {
  if (v === 'compact') return 'text-3xl md:text-4xl leading-tight'
  if (v === 'large') return 'text-4xl md:text-6xl leading-[1.05]'
  if (v === 'display') return 'text-4xl md:text-6xl lg:text-7xl leading-[0.95]'
  return 'text-3xl md:text-5xl lg:text-6xl leading-[1.05]'
}

function verdeIntroSizeClass(v: string): string {
  if (v === 'sm') return 'text-sm'
  if (v === 'base') return 'text-base'
  if (v === 'xl') return 'text-xl'
  if (v === '2xl') return 'text-2xl'
  return 'text-lg'
}

function verdeListHeadingSizeClass(v: string): string {
  if (v === 'sm') return 'text-xl'
  if (v === 'base') return 'text-2xl'
  if (v === 'lg') return 'text-3xl'
  if (v === 'xl') return 'text-4xl'
  return 'text-2xl'
}

/** Room cards stay 3-up on narrow screens — keep type small so whole words fit per column. */
function verdeRoomTitleSizeClass(v: string): string {
  if (v === 'sm') return 'text-[10px] sm:text-xs md:text-sm leading-snug'
  if (v === 'base') return 'text-[11px] sm:text-sm md:text-base leading-snug'
  if (v === 'lg') return 'text-xs sm:text-base md:text-lg leading-snug'
  if (v === 'xl') return 'text-sm sm:text-lg md:text-xl leading-snug'
  return 'text-[11px] sm:text-sm md:text-base leading-snug'
}

function verdeRoomBodySizeClass(v: string): string {
  if (v === 'xs') return 'text-[9px] sm:text-[10px] md:text-xs'
  if (v === 'base') return 'text-[10px] sm:text-xs md:text-sm'
  return 'text-[9px] sm:text-[10px] md:text-xs'
}

export function RestaurantMenuSection({
  props,
  colors,
  theme,
  products,
  isLoading,
  templateId,
  storePath,
  onPreviewNavigate,
  previewNavigateEnabled = true,
}: {
  props: SectionProps
  colors: HomeSectionThemeColors
  theme: HomeSectionTheme
  products: { items?: unknown[] } | null | undefined
  isLoading: boolean
  templateId?: string
  storePath: (p: string) => string
  onPreviewNavigate?: (to: string) => void
  previewNavigateEnabled?: boolean
}) {
  const showPrice = (props.show_price as string) !== 'no'
  const showDescription = (props.show_description as string) !== 'no'
  const note = str(props.note as string, '')
  const hasProducts = (products?.items?.length ?? 0) > 0
  const kit = editorialKitFromTemplate(templateId) === 'verde'

  type MenuItem = { id: string | number; name: string; price?: number; description?: string; currency?: string; short_description?: string }
  const menuItems: MenuItem[] = hasProducts
    ? (products!.items as MenuItem[]).slice(0, 8)
    : ([
        { id: 1, name: 'Charred leek, hazelnut, brown butter', price: 480, currency: '₹' },
        { id: 2, name: 'Hand-cut tartare, smoked yolk', price: 620, currency: '₹' },
        { id: 3, name: 'Wood-grilled branzino, fennel', price: 1200, currency: '₹' },
        { id: 4, name: 'Slow-cooked lamb shoulder', price: 1400, currency: '₹' },
        { id: 5, name: 'Olive oil cake, rosemary cream', price: 380, currency: '₹' },
        { id: 6, name: 'Dark chocolate, fleur de sel', price: 350, currency: '₹' },
      ] as MenuItem[])

  const spotlightKicker = str(props.menu_spotlight_kicker as string, '') || str(props.subtitle as string, 'Tonight')
  const menuHref = storefrontHref(props.view_all_link, storePath, '/products')
  const spotlightL1 = str(props.menu_spotlight_line1 as string, 'Charred leek,')
  const spotlightL2 = str(props.menu_spotlight_line2 as string, 'brown butter,')
  const spotlightAccent = str(props.menu_spotlight_accent as string, 'brown butter')
  const spotlightL3 = str(props.menu_spotlight_line3 as string, 'toasted hazelnut.')
  const viewAllLabel = str(props.view_all_label as string, 'See the full menu →')
  const ctaSize = str(props.menu_cta_link_size as string, 'sm')
  const ctaSizeClass =
    ctaSize === 'xl' ? 'text-xl' : ctaSize === 'lg' ? 'text-lg' : ctaSize === 'base' ? 'text-base' : 'text-sm'
  const roomCards: { title: string; body: string }[] = [
    { title: str(props.room_1_title as string, 'Dining Room'), body: str(props.room_1_body as string, 'An eight-table room. Candlelight, low music, no rush.') },
    { title: str(props.room_2_title as string, 'The Counter'), body: str(props.room_2_body as string, 'Six seats facing the open fire. Watch dinner happen.') },
    { title: str(props.room_3_title as string, 'Private'), body: str(props.room_3_body as string, 'A back room for ten. Bring your people.') },
  ]

  const kickerSize = verdeKickerSizeClass(str(props.menu_spotlight_kicker_size as string, ''))
  const kickerColor = safeSectionColor(props.menu_spotlight_kicker_color)
  const headlineSize = verdeHeadlineSizeClass(str(props.menu_spotlight_headline_size as string, ''))
  const headlineMainColor = safeSectionColor(props.menu_spotlight_headline_color)
  const accentColor = safeSectionColor(props.menu_spotlight_accent_color)
  const introSize = verdeIntroSizeClass(str(props.menu_spotlight_intro_size as string, ''))
  const introColor = safeSectionColor(props.menu_spotlight_intro_color)
  const ctaLinkColor = safeSectionColor(props.menu_cta_link_color)
  const listHeadingSize = verdeListHeadingSizeClass(str(props.menu_list_heading_size as string, ''))
  const listHeadingColor = safeSectionColor(props.menu_list_heading_color)
  const roomTitleSize = verdeRoomTitleSizeClass(str(props.room_card_title_size as string, ''))
  const roomTitleColor = safeSectionColor(props.room_card_title_color)
  const roomBodySize = verdeRoomBodySizeClass(str(props.room_card_body_size as string, ''))
  const roomBodyColor = safeSectionColor(props.room_card_body_color)

  const headlineLineStyle: CSSProperties | undefined = headlineMainColor ? { color: headlineMainColor } : undefined
  const accentEmStyle: CSSProperties | undefined = accentColor ? { color: accentColor } : undefined
  const accentEmClass = accentColor ? 'font-serif-it not-italic' : 'font-serif-it text-resto-accent not-italic'

  const listBlock = (
    <div data-builder-field="menu_list_area">
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className={`w-6 h-6 animate-spin ${kit ? 'text-resto-accent' : ''}`} style={kit ? undefined : { color: colors.primary }} /></div>
      ) : (
        <ul className={`space-y-5 max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 ${kit ? 'text-resto-ink' : ''}`}>
          {menuItems.map((item: MenuItem) => (
            <li key={item.id} className="flex items-baseline gap-4 pb-4" style={kit ? { borderBottom: '1px dashed rgba(244,240,232,0.12)' } : { borderBottom: `1px dashed ${colors.primary}25` }}>
              <div className="flex-1 min-w-0">
                <span className={`text-base sm:text-lg font-medium ${kit ? 'text-resto-ink' : 'text-gray-900'}`}>{item.name}</span>
                {showDescription && item.short_description && (
                  <p className={`text-sm mt-0.5 ${kit ? 'opacity-60' : 'text-gray-500'}`}>{item.short_description}</p>
                )}
              </div>
              <span className="flex-1 mx-3 self-baseline mb-1" style={kit ? { borderBottom: '1px dotted rgba(244,240,232,0.15)' } : { borderBottom: `1px dotted ${colors.primary}20` }} />
              {showPrice && (item.price !== undefined) && (
                <span className={`shrink-0 text-sm opacity-70 ${kit ? 'text-resto-ink' : 'text-gray-900'}`}>
                  {item.currency || '₹'} {typeof item.price === 'number' ? item.price.toLocaleString() : item.price}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!hasProducts && (
        <p className={`text-center text-sm mt-6 italic ${kit ? 'text-resto-ink/50' : 'text-gray-400'}`}>
          Showing placeholder items — add Products to your store to populate this menu
        </p>
      )}
      {note && <p className={`text-center text-sm italic mt-8 ${kit ? 'text-resto-ink/50' : 'text-gray-400'}`}>{note}</p>}
    </div>
  )

  if (kit) {
    return (
      <main className="bg-resto-bg text-resto-ink">
        <section className="max-w-5xl mx-auto px-6 lg:px-10 py-32 text-center">
          <p
            data-builder-field="menu_spotlight_kicker"
            className={`uppercase tracking-[0.3em] mb-8 font-medium ${kickerSize} ${kickerColor ? '' : 'text-resto-ink opacity-60'}`}
            style={{ ...(kickerColor ? { color: kickerColor } : {}), ...fieldTypographyStyle(props, 'subtitle'), ...fieldTypographyStyle(props, 'menu_spotlight_kicker') }}
          >
            {spotlightKicker}
          </p>
          <h2 data-builder-field="menu_spotlight_headline" className={`font-display mb-10 ${headlineSize} ${headlineMainColor ? '' : 'text-resto-ink'}`}>
            <span style={{ ...headlineLineStyle, ...fieldTypographyStyle(props, 'menu_spotlight_line1') }}>{spotlightL1}</span>
            <br />
            <span style={fieldTypographyStyle(props, 'menu_spotlight_line2')}>{accentInText(spotlightL2, spotlightAccent, accentEmClass, accentEmStyle)}</span>
            <br />
            <span style={{ ...headlineLineStyle, ...fieldTypographyStyle(props, 'menu_spotlight_line3') }}>{spotlightL3}</span>
          </h2>
          <p
            data-builder-field="description"
            className={`max-w-xl mx-auto leading-relaxed ${introSize} ${introColor ? '' : 'text-resto-ink opacity-70'}`}
            style={{ ...(introColor ? { color: introColor } : {}), ...fieldTypographyStyle(props, 'description') }}
          >
            {str(props.description as string, 'A six-course tasting menu that changes with the markets. Eat what we found this morning.')}
          </p>
          <span data-builder-field="view_all_label" className="inline-block mt-10">
            <SectionNavLink
              onPreviewNavigate={onPreviewNavigate}
              previewNavigateEnabled={previewNavigateEnabled}
              to={menuHref}
              className={`inline-block ${ctaSizeClass} border-b pb-1 ${ctaLinkColor ? '' : 'border-resto-ink/30 text-resto-ink'}`}
              style={
                ctaLinkColor
                  ? { color: ctaLinkColor, borderBottomColor: `${ctaLinkColor}99`, ...fieldTypographyStyle(props, 'view_all_label') }
                  : { ...fieldTypographyStyle(props, 'view_all_label') }
              }
            >
              {viewAllLabel}
            </SectionNavLink>
          </span>
        </section>
        <section className="pb-16">
          <h3
            data-builder-field="title"
            className={`font-display text-center mb-8 ${listHeadingSize} ${listHeadingColor ? '' : 'text-resto-ink'}`}
            style={{ ...(listHeadingColor ? { color: listHeadingColor } : {}), ...fieldTypographyStyle(props, 'title') }}
          >
            {str(props.title as string, 'À la carte')}
          </h3>
          {listBlock}
        </section>
        <section data-builder-field="room_cards" className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-10 pb-20 sm:pb-24">
          {/*
            Original section layout: three columns + hairline gutters (gap-px) inside a rounded shell.
            Tight insets + small type keep copy to whole-word wraps; explicit wordBreak avoids odd splits.
          */}
          <div className="grid grid-cols-3 gap-px bg-resto-ink/15 rounded-3xl overflow-hidden">
            {roomCards.map((room, idx) => (
              <div
                key={`${room.title}-${idx}`}
                className="min-w-0 bg-resto-bg px-2 py-4 sm:px-2.5 sm:py-5 md:px-3.5 md:py-6 lg:px-5 lg:py-8"
              >
                <h3
                  className={`font-display mb-1.5 text-center text-balance hyphens-none ${roomTitleSize} ${roomTitleColor ? '' : 'text-resto-ink'}`}
                  style={{
                    wordBreak: 'normal',
                    overflowWrap: 'break-word',
                    ...(roomTitleColor ? { color: roomTitleColor } : {}),
                  }}
                >
                  {room.title}
                </h3>
                <p
                  className={`text-center text-balance leading-snug hyphens-none ${roomBodySize} ${roomBodyColor ? '' : 'text-resto-ink opacity-70'}`}
                  style={{
                    wordBreak: 'normal',
                    overflowWrap: 'break-word',
                    ...(roomBodyColor ? { color: roomBodyColor } : {}),
                  }}
                >
                  {room.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <section className="py-16" style={{ backgroundColor: colors.background }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10">
        {(props.subtitle as string) && (
          <p data-builder-field="subtitle" className="text-xs uppercase tracking-[0.3em] text-center mb-4" style={{ color: colors.primary, ...fieldTypographyStyle(props, 'subtitle') }}>{props.subtitle as string}</p>
        )}
        <h2 data-builder-field="title" className="text-3xl sm:text-4xl md:text-5xl text-center mb-10 font-bold" style={{ fontFamily: theme.font, ...fieldTypographyStyle(props, 'title') }}>
          {str(props.title as string, 'À la carte.')}
        </h2>
        {listBlock}
      </div>
    </section>
  )
}
