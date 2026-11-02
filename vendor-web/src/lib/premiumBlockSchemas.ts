/**
 * Field schemas + palette defaults for the premium Silk Atelier blocks (silk_atelier_*).
 * The schema drives <PremiumBlockEditor>, so every label, link, image and product-category
 * filter of these sections can be edited in the builder without touching code.
 */

export type PremiumFieldType =
  | 'text' | 'textarea' | 'url' | 'number' | 'boolean' | 'color' | 'select' | 'image'
  | 'tags'      // comma separated list of strings
  | 'strings'   // one string per line
  | 'list'      // array of objects described by `fields`

export interface PremiumFieldDef {
  key: string
  label: string
  type: PremiumFieldType
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /** list: sub-fields of each item */
  fields?: PremiumFieldDef[]
  /** list: name used for "Add <itemLabel>" and the default card title */
  itemLabel?: string
  /** list: item key shown as the card title */
  titleKey?: string
  /** list: template for a freshly added item */
  defaultItem?: Record<string, unknown>
  /** only render this field when the predicate holds for the surrounding object */
  showIf?: (obj: Record<string, unknown>) => boolean
}

export interface PremiumBlockSchema {
  type: string
  label: string
  desc: string
  defaultProps: Record<string, unknown>
  fields: PremiumFieldDef[]
}

const LINK_HINT = 'Page (/about) or a category page: /products?category=<exact category name>'
const FILTER_HINT = 'Product categories / brands / tags to show here, comma separated. Must match your product categories.'

const t = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'text', ...extra })
const ta = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'textarea', ...extra })
const url = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'url', hint: LINK_HINT, ...extra })
const image = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'image', ...extra })
const num = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'number', ...extra })
const bool = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'boolean', ...extra })
const color = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'color', ...extra })
const tags = (key: string, label: string, extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({ key, label, type: 'tags', hint: FILTER_HINT, ...extra })
const select = (key: string, label: string, options: [string, string][], extra: Partial<PremiumFieldDef> = {}): PremiumFieldDef => ({
  key, label, type: 'select', options: options.map(([value, lbl]) => ({ value, label: lbl })), ...extra,
})

const linkItem: PremiumFieldDef[] = [t('label', 'Label'), url('url', 'Link')]
const tileItem: PremiumFieldDef[] = [t('title', 'Title'), t('subtitle', 'Small text', { placeholder: 'e.g. 120+ DESIGNS' }), image('image_url', 'Image'), url('url', 'Link')]

export const PREMIUM_BLOCK_SCHEMAS: PremiumBlockSchema[] = [
  {
    type: 'silk_atelier_mega_nav',
    label: 'Collections menu',
    desc: 'Mega menu bar with dropdown panels, linked to your categories',
    defaultProps: {
      bar_bg: '#FFFFFF', bar_text: '#5A0B3A', panel_bg: '#F6F3EE', bar_height: 44, mobile_label: 'Browse collections',
      items: [
        { label: 'New Arrivals', url: '/new-arrivals' },
        {
          label: 'Collections', url: '/products', layout: 'columns',
          columns: [{ title: 'Popular', links: [{ label: 'All products', url: '/products' }] }],
        },
      ],
    },
    fields: [
      t('mobile_label', 'Mobile menu label'),
      num('bar_height', 'Bar height (px)', { hint: 'White category row height on desktop (36–52). Reference boutique sites use ~44.' }),
      color('bar_bg', 'Bar background'),
      color('bar_text', 'Bar text colour'),
      color('panel_bg', 'Dropdown background'),
      {
        key: 'items', label: 'Menu items', type: 'list', itemLabel: 'menu item', titleKey: 'label',
        defaultItem: { label: 'New menu', url: '/products', layout: 'columns', columns: [{ title: 'Group', links: [{ label: 'Link', url: '/products' }] }] },
        fields: [
          t('label', 'Menu label'),
          url('url', 'Link (when clicked)'),
          select('layout', 'Dropdown style', [['columns', 'Columns of links'], ['tiles', 'Image tiles']], { hint: 'Leave both groups empty for a plain link without a dropdown.' }),
          t('panel_title', 'Dropdown heading', { showIf: (o) => o.layout === 'tiles' }),
          image('feature_image', 'Featured image (right side)', { showIf: (o) => o.layout !== 'tiles' }),
          url('feature_url', 'Featured image link', { showIf: (o) => o.layout !== 'tiles' }),
          t('footer_link_label', 'Footer link under first column', { showIf: (o) => o.layout !== 'tiles', placeholder: 'All Silk Sarees' }),
          {
            key: 'columns', label: 'Link columns', type: 'list', itemLabel: 'column', titleKey: 'title',
            showIf: (o) => o.layout !== 'tiles',
            defaultItem: { title: 'Group', links: [{ label: 'Link', url: '/products' }] },
            fields: [
              t('title', 'Column heading'),
              { key: 'links', label: 'Links', type: 'list', itemLabel: 'link', titleKey: 'label', defaultItem: { label: 'New link', url: '/products' }, fields: linkItem },
            ],
          },
          {
            key: 'tiles', label: 'Image tiles', type: 'list', itemLabel: 'tile', titleKey: 'label',
            showIf: (o) => o.layout === 'tiles',
            defaultItem: { label: 'New tile', url: '/products' },
            fields: [t('label', 'Label'), image('image_url', 'Image'), url('url', 'Link')],
          },
        ],
      },
    ],
  },
  {
    type: 'silk_atelier_hero',
    label: 'Premium hero banner',
    desc: 'Full-width festive banner with headline, offer and two buttons',
    defaultProps: {
      eyebrow: 'New season', headline: 'Light Up', headline_accent: 'Every Celebration', offer: 'Flat 10% Off',
      subtitle: 'Pure silks, bridal sarees and festive favourites.',
      cta_primary: 'Shop the collection', cta_primary_url: '/products',
      cta_secondary: 'New arrivals', cta_secondary_url: '/new-arrivals',
      text_align: 'right', min_height: 480,
    },
    fields: [
      image('image_url', 'Banner image', { hint: 'Wide image, about 2400 x 900 px. Keep the subject on the left if the text sits on the right.' }),
      t('image_alt', 'Image description (for accessibility)'),
      t('eyebrow', 'Small heading'),
      t('headline', 'Headline'),
      t('headline_accent', 'Headline (gold part)'),
      t('offer', 'Offer badge'),
      ta('subtitle', 'Sub-text'),
      t('cta_primary', 'Main button label'), url('cta_primary_url', 'Main button link'),
      t('cta_secondary', 'Second button label'), url('cta_secondary_url', 'Second button link'),
      select('text_align', 'Text position', [['right', 'Right'], ['left', 'Left']]),
      num('min_height', 'Banner height (px)'),
    ],
  },
  {
    type: 'silk_atelier_drops',
    label: "Timed new arrivals",
    desc: 'New designs unlocking through the day, by time slot',
    defaultProps: {
      title_before: "Today's", title_accent: 'New Arrivals', subtitle: 'Fresh designs unlock through the day.',
      unlock_by_time: true, items_per_slot: 10, show_count: 200,
      slots: [
        { time: '7:00 AM', label: 'Morning drop', category_filter: [], url: '/products' },
        { time: '5:00 PM', label: 'Evening drop', category_filter: [], url: '/products' },
      ],
      extra_links: [],
    },
    fields: [
      t('title_before', 'Heading (plain part)'), t('title_accent', 'Heading (gold part)'), ta('subtitle', 'Sub-text'),
      bool('unlock_by_time', 'Unlock slots by time of day'),
      num('items_per_slot', 'Products per slot'),
      {
        key: 'slots', label: 'Time slots', type: 'list', itemLabel: 'slot', titleKey: 'label',
        defaultItem: { time: '12:00 PM', label: 'New slot', category_filter: [], url: '/products' },
        fields: [t('time', 'Time', { placeholder: '7:00 AM' }), t('label', 'Label'), tags('category_filter', 'Products shown'), url('url', 'See-all link')],
      },
      { key: 'extra_links', label: 'Extra quick links', type: 'list', itemLabel: 'link', titleKey: 'label', defaultItem: { label: 'New link', url: '/products' }, fields: linkItem },
    ],
  },
  {
    type: 'silk_atelier_brand_tabs',
    label: 'Collection tabs',
    desc: 'Tabbed showcase with a promo image and products per tab',
    defaultProps: {
      eyebrow: 'Tradition for generations', title_before: 'Pure', title_accent: 'Kanchipuram', title_after: 'Silks',
      subtitle: 'Handwoven in pure silk and zari.', chips: ['Handwoven', 'Pure silk & zari'], items_per_tab: 12, show_count: 200,
      brands: [{ name: 'Collection one', designs_label: '100+', category_filter: [], promo_image: '', explore_url: '/products' }],
    },
    fields: [
      t('eyebrow', 'Small heading'),
      t('title_before', 'Heading (start)'), t('title_accent', 'Heading (gold part)'), t('title_after', 'Heading (end)'),
      ta('subtitle', 'Sub-text'),
      { key: 'chips', label: 'Highlight chips', type: 'strings', hint: 'One per line' },
      num('items_per_tab', 'Products per tab'),
      {
        key: 'brands', label: 'Tabs', type: 'list', itemLabel: 'tab', titleKey: 'name',
        defaultItem: { name: 'New tab', designs_label: '50+', category_filter: [], promo_image: '', explore_url: '/products' },
        fields: [t('name', 'Tab name'), t('designs_label', 'Designs count text', { placeholder: '200+' }), tags('category_filter', 'Products shown'), image('promo_image', 'Promo image'), url('explore_url', 'Explore link')],
      },
    ],
  },
  {
    type: 'silk_atelier_looms',
    label: 'Heritage stories',
    desc: 'Story cards (region / weave / craft) with products for each',
    defaultProps: {
      eyebrow: 'The silk saree store', title: 'Heritage Looms', subtitle: 'A celebration of India\'s silk legacy.',
      badge_label: 'Certified', items_per_tab: 11, show_count: 200,
      looms: [{ name: 'Mysore Silk', state: 'Karnataka', certified: true, story: 'Add the story of this craft here.', weave: '', known_for: '', wear_for: '', category_filter: [], view_all_url: '/products' }],
    },
    fields: [
      t('eyebrow', 'Small heading'), t('title', 'Heading'), ta('subtitle', 'Sub-text'), t('badge_label', 'Badge text'),
      num('items_per_tab', 'Products per story'),
      {
        key: 'looms', label: 'Stories', type: 'list', itemLabel: 'story', titleKey: 'name',
        defaultItem: { name: 'New story', state: '', certified: true, story: '', weave: '', known_for: '', wear_for: '', category_filter: [], view_all_url: '/products' },
        fields: [
          t('name', 'Name'), t('state', 'Region / origin'), bool('certified', 'Show certified badge'),
          image('hero_image', 'Large image'), image('thumb_image', 'Small image'),
          ta('story', 'Story'), t('weave', 'Weave'), t('known_for', 'Known for'), t('wear_for', 'Worn for'),
          tags('category_filter', 'Products shown'), url('view_all_url', 'View-all link'),
        ],
      },
    ],
  },
  {
    type: 'silk_atelier_tiles',
    label: 'Image tiles',
    desc: 'Arch, round, poster or card tiles linking to categories',
    defaultProps: {
      title: 'Shop by collection', shape: 'arch', columns: 4, layout: 'grid',
      sections: [{ heading: '', items: [{ title: 'Collection', subtitle: '', image_url: '', url: '/products' }] }],
    },
    fields: [
      t('title_bold', 'Heading (bold lead-in, optional)'), t('title', 'Heading'), ta('subtitle', 'Sub-text'),
      select('shape', 'Tile shape', [['arch', 'Arch'], ['round', 'Round'], ['poster', 'Poster'], ['card', 'Card']]),
      select('layout', 'Layout', [['grid', 'Grid'], ['scroll', 'Scrolling row']]),
      num('columns', 'Columns (grid)'),
      color('section_bg', 'Section background'),
      t('cta_label', 'Button label'), url('cta_url', 'Button link'),
      {
        key: 'sections', label: 'Tile groups', type: 'list', itemLabel: 'group', titleKey: 'heading',
        defaultItem: { heading: 'New group', items: [{ title: 'Collection', subtitle: '', image_url: '', url: '/products' }] },
        fields: [
          t('heading', 'Group heading (optional)'),
          { key: 'items', label: 'Tiles', type: 'list', itemLabel: 'tile', titleKey: 'title', defaultItem: { title: 'New tile', subtitle: '', image_url: '', url: '/products' }, fields: tileItem },
        ],
      },
    ],
  },
  {
    type: 'silk_atelier_product_carousel',
    label: 'Product carousel',
    desc: 'Scrolling row of products from chosen categories',
    defaultProps: { title_bold: 'ROYAL', title: 'Featured', tagline: '', category_filter: [], count: 12, card_shape: 'portrait', card_width: 240, view_all_url: '/products', show_count: 200 },
    fields: [
      t('title_bold', 'Heading (bold lead-in)'), t('title', 'Heading'), t('tagline', 'Tagline'),
      tags('category_filter', 'Products shown'),
      num('count', 'How many products'),
      select('card_shape', 'Card shape', [['portrait', 'Portrait'], ['arch', 'Arch'], ['rounded', 'Rounded']]),
      num('card_width', 'Card width (px)'),
      url('view_all_url', 'View-all link'),
    ],
  },
  {
    type: 'silk_atelier_promo',
    label: 'Promo / gift card banner',
    desc: 'Banner with headline, value chips and a button',
    defaultProps: {
      eyebrow: 'Gifting', title_before: 'Gift the joy of', title_accent: 'a saree', title_after: 'this season.',
      subtitle: 'They choose the drape, you get the smile.', amounts_label: 'Choose a value',
      amounts: ['1,000', '2,000', '5,000'], cta_label: 'Gift a card', cta_url: '/contact', bg_image: '',
    },
    fields: [
      t('eyebrow', 'Small heading'),
      t('title_before', 'Heading (start)'), t('title_accent', 'Heading (gold part)'), t('title_after', 'Heading (end)'),
      ta('subtitle', 'Sub-text'),
      t('amounts_label', 'Chips label'),
      { key: 'amounts', label: 'Chips', type: 'strings', hint: 'One per line, e.g. ₹1,000' },
      t('cta_label', 'Button label'), url('cta_url', 'Button link'),
      image('bg_image', 'Background image'),
    ],
  },
  {
    type: 'silk_atelier_stores',
    label: 'Store locations',
    desc: 'Showroom cards with photo, address, phone and map link',
    defaultProps: {
      chip: 'Our showroom', title: 'Visit Our Stores', subtitle: 'Experience our full collection in person.', columns: 2,
      stores: [{ city: 'Main showroom', name: 'Your store name', address: 'Add your address here.', image_url: '', phone: '', map_url: '', rating: 0, reviews: 0 }],
    },
    fields: [
      t('chip', 'Small heading'), t('title', 'Heading'), ta('subtitle', 'Sub-text'), num('columns', 'Columns'),
      {
        key: 'stores', label: 'Stores', type: 'list', itemLabel: 'store', titleKey: 'city',
        defaultItem: { city: 'New store', name: '', address: '', image_url: '', phone: '', map_url: '', rating: 0, reviews: 0 },
        fields: [
          t('city', 'City / label'), t('name', 'Store name'), ta('address', 'Address'),
          image('image_url', 'Photo'), t('phone', 'Phone'), url('map_url', 'Google Maps link', { hint: 'Paste the share link from Google Maps' }),
          num('rating', 'Rating (0-5)'), num('reviews', 'Review count'),
        ],
      },
    ],
  },
]

export const PREMIUM_BLOCK_TYPES = new Set(PREMIUM_BLOCK_SCHEMAS.map(s => s.type))

export function getPremiumSchema(blockType: string): PremiumBlockSchema | undefined {
  return PREMIUM_BLOCK_SCHEMAS.find(s => s.type === blockType)
}

/** Extra fields for stock blocks that gained opt-in premium options (announcement bar, nav). */
export const PREMIUM_STOCK_EXTRA_FIELDS: Record<string, PremiumFieldDef[]> = {
  announcement_bar: [
    t('lead_text', 'Lead word (gold, left)', { hint: 'Optional. e.g. Wedding Season' }),
    t('text_highlight', 'Highlighted offer', { hint: 'Optional. e.g. Flat 10% off' }),
    color('accent_color', 'Accent colour'),
  ],
  nav: [
    t('search_placeholder', 'Search box placeholder'),
    t('cart_total_prefix', 'Cart total prefix', { hint: 'e.g. Rs. or ₹' }),
    bool('show_cart_total', 'Show cart total next to the bag'),
  ],
}
