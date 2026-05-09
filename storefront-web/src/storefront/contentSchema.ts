/**
 * Per-template content schemas — defines which sections and fields are
 * editable in the visual Content editor panel.
 */

export type FieldType = 'text' | 'textarea' | 'image'

export interface EditField {
  /** Key into the ContentMap (e.g. 'hero.headline'). */
  key: string
  label: string
  type: FieldType
  fallback: string
}

export interface EditSection {
  /** Matches the data-edit-id attribute on the template section element. */
  id: string
  label: string
  fields: EditField[]
}

export type ContentSchema = EditSection[]

// ── Fashion (Atelier) ─────────────────────────────────────────────────────────
const FASHION_SCHEMA: ContentSchema = [
  {
    id: 'hero',
    label: 'Hero banner',
    fields: [
      { key: 'hero.season',   label: 'Season label',      type: 'text',     fallback: 'Autumn/Winter Collection' },
      { key: 'hero.line1',    label: 'Headline (line 1)', type: 'text',     fallback: 'Quiet luxury,' },
      { key: 'hero.line2',    label: 'Headline (line 2)', type: 'text',     fallback: 'built to last.' },
      { key: 'hero.subtitle', label: 'Subtitle',          type: 'textarea', fallback: 'Editorial silhouettes, considered fabrics, made in small runs. Discover pieces designed to outlive the season.' },
      { key: 'hero.cta1',     label: 'Primary button',    type: 'text',     fallback: 'Shop the collection' },
      { key: 'hero.cta2',     label: 'Secondary button',  type: 'text',     fallback: 'View lookbook' },
      { key: 'hero.image',    label: 'Hero image URL',    type: 'image',    fallback: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80' },
    ],
  },
  {
    id: 'marquee',
    label: 'Scrolling strip',
    fields: [
      { key: 'marquee.items', label: 'Strip items (comma-separated)', type: 'textarea', fallback: 'Made in Portugal,Hand-finished,Free returns,Carbon-neutral shipping,Small batch,Since 2014' },
    ],
  },
  {
    id: 'categories',
    label: 'Categories section',
    fields: [
      { key: 'categories.eyebrow', label: 'Eyebrow text',     type: 'text', fallback: 'Shop by category' },
      { key: 'categories.title',   label: 'Section heading',  type: 'text', fallback: 'The edit' },
    ],
  },
  {
    id: 'about',
    label: 'About section',
    fields: [
      { key: 'about.eyebrow',  label: 'Eyebrow',    type: 'text',     fallback: 'Our craft' },
      { key: 'about.headline', label: 'Headline',   type: 'text',     fallback: 'We make fewer pieces, with more care.' },
      { key: 'about.body',     label: 'Body text',  type: 'textarea', fallback: 'Every garment is cut and finished in our partner workshop in Porto. We work with mills that have served the same families for generations — and we tell you exactly where each piece comes from.' },
    ],
  },
]

// ── Electronics (Voltage) ─────────────────────────────────────────────────────
const ELECTRONICS_SCHEMA: ContentSchema = [
  {
    id: 'deals',
    label: 'Deals strip',
    fields: [
      { key: 'deals.text', label: 'Strip text', type: 'text', fallback: 'Spring Sale · up to 25% off select audio · 2-year warranty included' },
    ],
  },
  {
    id: 'hero',
    label: 'Hero banner',
    fields: [
      { key: 'hero.badge',    label: 'Badge / eyebrow',   type: 'text',     fallback: 'Aurora X14 · just landed' },
      { key: 'hero.line1',    label: 'Headline (line 1)', type: 'text',     fallback: 'Power,' },
      { key: 'hero.line2',    label: 'Headline (accent)', type: 'text',     fallback: 'perfected.' },
      { key: 'hero.subtitle', label: 'Subtitle',          type: 'textarea', fallback: 'The fastest mobile chip we\'ve ever shipped. 120Hz OLED. Triple 50MP camera. A titanium frame you can actually feel.' },
      { key: 'hero.cta1',     label: 'Primary button',    type: 'text',     fallback: 'Pre-order' },
      { key: 'hero.image',    label: 'Product image URL', type: 'image',    fallback: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    id: 'specs',
    label: 'Tech specs strip',
    fields: [
      { key: 'specs.display', label: 'Spec 1 value', type: 'text', fallback: '6.7" OLED' },
      { key: 'specs.refresh', label: 'Spec 2 value', type: 'text', fallback: '120 Hz' },
      { key: 'specs.battery', label: 'Spec 3 value', type: 'text', fallback: '4800 mAh' },
    ],
  },
  {
    id: 'products',
    label: 'Products section',
    fields: [
      { key: 'products.eyebrow', label: 'Eyebrow',  type: 'text', fallback: 'Featured' },
      { key: 'products.heading', label: 'Heading',  type: 'text', fallback: 'Top rated this season' },
    ],
  },
  {
    id: 'trust',
    label: 'Trust strip',
    fields: [
      { key: 'trust.item1_title', label: 'Item 1 title', type: 'text', fallback: '2-year warranty' },
      { key: 'trust.item1_desc',  label: 'Item 1 desc',  type: 'text', fallback: 'On every product, no fine print.' },
      { key: 'trust.item2_title', label: 'Item 2 title', type: 'text', fallback: 'Free shipping' },
      { key: 'trust.item2_desc',  label: 'Item 2 desc',  type: 'text', fallback: 'Orders over $50, anywhere in the country.' },
      { key: 'trust.item3_title', label: 'Item 3 title', type: 'text', fallback: 'Expert support' },
      { key: 'trust.item3_desc',  label: 'Item 3 desc',  type: 'text', fallback: 'Real engineers, 7 days a week.' },
    ],
  },
]

// ── Grocery (Pantry) ──────────────────────────────────────────────────────────
const GROCERY_SCHEMA: ContentSchema = [
  {
    id: 'hero',
    label: 'Hero / search',
    fields: [
      { key: 'hero.line1',    label: 'Headline (line 1)',  type: 'text',     fallback: 'Fresh from the market,' },
      { key: 'hero.line2',    label: 'Headline (accent)',  type: 'text',     fallback: 'at your door.' },
      { key: 'hero.subtitle', label: 'Subtitle',           type: 'text',     fallback: 'Order before 4pm for same-day delivery.' },
      { key: 'hero.search',   label: 'Search placeholder', type: 'text',     fallback: 'Search for milk, bread, fruits…' },
      { key: 'hero.badge1',   label: 'Badge 1',            type: 'text',     fallback: 'Free delivery over $30' },
      { key: 'hero.badge2',   label: 'Badge 2',            type: 'text',     fallback: '2-hour delivery slots' },
      { key: 'hero.badge3',   label: 'Badge 3',            type: 'text',     fallback: 'No minimum order' },
    ],
  },
  {
    id: 'categories',
    label: 'Categories heading',
    fields: [
      { key: 'categories.heading', label: 'Heading', type: 'text', fallback: 'Shop by category' },
    ],
  },
  {
    id: 'promo',
    label: 'Promo banners',
    fields: [
      { key: 'promo.1_title', label: 'Promo 1 title', type: 'text', fallback: 'Weekend Bundle' },
      { key: 'promo.1_desc',  label: 'Promo 1 desc',  type: 'text', fallback: 'Save 15% on fresh produce' },
      { key: 'promo.2_title', label: 'Promo 2 title', type: 'text', fallback: 'Bakery Daily' },
      { key: 'promo.2_desc',  label: 'Promo 2 desc',  type: 'text', fallback: 'Loaves baked at 6am' },
      { key: 'promo.3_title', label: 'Promo 3 title', type: 'text', fallback: 'Pantry Top-Up' },
      { key: 'promo.3_desc',  label: 'Promo 3 desc',  type: 'text', fallback: 'Buy 2, get 1 free on staples' },
    ],
  },
  {
    id: 'products',
    label: 'Products heading',
    fields: [
      { key: 'products.heading', label: 'Heading', type: 'text', fallback: 'Best sellers' },
    ],
  },
]

// ── Restaurant (Larder) ───────────────────────────────────────────────────────
const RESTAURANT_SCHEMA: ContentSchema = [
  {
    id: 'info',
    label: 'Info strip',
    fields: [
      { key: 'info.address', label: 'Address',         type: 'text', fallback: '14 Larch Lane, Brooklyn NY' },
      { key: 'info.hours',   label: 'Opening hours',   type: 'text', fallback: 'Tue–Sun · 5pm – 11pm' },
      { key: 'info.phone',   label: 'Phone number',    type: 'text', fallback: '+1 (212) 555-0184' },
    ],
  },
  {
    id: 'hero',
    label: 'Hero banner',
    fields: [
      { key: 'hero.badge',    label: 'Badge / eyebrow', type: 'text',     fallback: 'Seasonal · Tasting menu' },
      { key: 'hero.headline', label: 'Headline',        type: 'textarea', fallback: 'A modern table, set in the old way.' },
      { key: 'hero.subtitle', label: 'Subtitle',        type: 'textarea', fallback: 'Wood-fired plates, low-intervention wines and a menu that changes with what arrives at the door.' },
      { key: 'hero.cta1',     label: 'Primary button',  type: 'text',     fallback: 'Reserve a table' },
      { key: 'hero.cta2',     label: 'Secondary button',type: 'text',     fallback: 'Order takeout' },
      { key: 'hero.image',    label: 'Hero image URL',  type: 'image',    fallback: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=2000&q=80' },
    ],
  },
  {
    id: 'menu',
    label: 'Menu section',
    fields: [
      { key: 'menu.season',  label: 'Season label',   type: 'text', fallback: 'Spring menu' },
      { key: 'menu.heading', label: 'Menu heading',   type: 'text', fallback: 'What we\'re cooking' },
    ],
  },
  {
    id: 'review',
    label: 'Review quote',
    fields: [
      { key: 'review.quote',       label: 'Review quote',  type: 'textarea', fallback: '"An honest, generous, deeply seasonal kitchen. Every plate feels like it could only have come from this room."' },
      { key: 'review.attribution', label: 'Attribution',   type: 'text',     fallback: '— New York Eater · 2025' },
    ],
  },
]

// ── Services (Studio) ─────────────────────────────────────────────────────────
const SERVICES_SCHEMA: ContentSchema = [
  {
    id: 'hero',
    label: 'Hero banner',
    fields: [
      { key: 'hero.badge',    label: 'Badge / eyebrow',   type: 'text',     fallback: 'Bookings open · Spring' },
      { key: 'hero.line1',    label: 'Headline (line 1)', type: 'text',     fallback: 'Care,' },
      { key: 'hero.line2',    label: 'Headline (accent)', type: 'text',     fallback: 'by appointment.' },
      { key: 'hero.subtitle', label: 'Subtitle',          type: 'textarea', fallback: 'A small studio of stylists, colorists and barbers — with the time and tools to do it properly.' },
      { key: 'hero.cta1',     label: 'Primary button',    type: 'text',     fallback: 'Book now' },
      { key: 'hero.cta2',     label: 'Secondary button',  type: 'text',     fallback: 'See services' },
    ],
  },
  {
    id: 'services',
    label: 'Services section',
    fields: [
      { key: 'services.heading', label: 'Heading', type: 'text', fallback: 'Services' },
    ],
  },
  {
    id: 'team',
    label: 'Team section',
    fields: [
      { key: 'team.heading', label: 'Heading', type: 'text', fallback: 'The team' },
    ],
  },
  {
    id: 'booking',
    label: 'Booking section',
    fields: [
      { key: 'booking.heading',  label: 'Heading',          type: 'text',     fallback: 'Book your slot' },
      { key: 'booking.subtitle', label: 'Subtitle',         type: 'textarea', fallback: 'Choose a service and a time — we\'ll confirm by SMS within minutes.' },
      { key: 'booking.confirm',  label: 'Confirm button',   type: 'text',     fallback: 'Confirm booking' },
    ],
  },
]

// ── Exports ───────────────────────────────────────────────────────────────────
export const CONTENT_SCHEMAS: Record<string, ContentSchema> = {
  storefront_fashion:     FASHION_SCHEMA,
  storefront_electronics: ELECTRONICS_SCHEMA,
  storefront_grocery:     GROCERY_SCHEMA,
  storefront_restaurant:  RESTAURANT_SCHEMA,
  storefront_services:    SERVICES_SCHEMA,
}
