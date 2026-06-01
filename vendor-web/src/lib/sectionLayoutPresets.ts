/** Layout variants shown when adding a section from the builder catalog. */
import { FOOTER_LAYOUT_PRESETS } from '@/lib/footerLayoutTheme'

export type SectionLayoutPreset = {
  label: string
  desc?: string
  props: Record<string, unknown>
}

export const BLOCK_QUICK_PRESETS: Record<string, SectionLayoutPreset[]> = {
  hero: [
    { label: 'Gradient Dark', desc: 'Violet/indigo gradient over image', props: { bg_style: 'gradient', gradient_preset: 'Violet → Indigo', overlay: true, layout: 'centered' } },
    { label: 'Image Full', desc: 'Full-bleed photo background', props: { bg_style: 'image', overlay: true, layout: 'centered' } },
    { label: 'Clean Light', desc: 'White minimal hero', props: { bg_style: 'minimal', overlay: false, layout: 'centered' } },
    { label: 'Dark Bold', desc: 'Dark dramatic hero', props: { bg_style: 'solid', bg_color: '#0f172a', overlay: true, layout: 'centered' } },
    { label: 'Brand Color', desc: 'Primary brand gradient', props: { bg_style: 'gradient', overlay: false, layout: 'centered' } },
    { label: 'Soft Surface', desc: 'Light gray background', props: { bg_style: 'minimal', bg_color: '#f8fafc', layout: 'centered' } },
  ],
  hero_split: [
    { label: 'Image Right', desc: 'Copy left, photo right', props: { bg_style: 'minimal', layout: 'split', image_position: 'right' } },
    { label: 'Image Left', desc: 'Photo left, copy right', props: { bg_style: 'minimal', layout: 'split', image_position: 'left' } },
    { label: 'Gradient Left', desc: 'Text left, gradient panel', props: { bg_style: 'gradient', layout: 'split' } },
    { label: 'White Clean', desc: 'Minimal split layout', props: { bg_style: 'minimal', layout: 'split' } },
    { label: 'Dark Split', desc: 'Dark text panel + image', props: { bg_style: 'solid', bg_color: '#0f172a', layout: 'split' } },
  ],
  hero_minimal: [
    { label: 'Clean Minimal', desc: 'Text-focused hero', props: { bg_style: 'minimal', layout: 'minimal' } },
    { label: 'Light Surface', desc: 'Soft gray background', props: { bg_style: 'light', layout: 'minimal' } },
    { label: 'Dark Statement', desc: 'Bold headline + square CTA', props: { bg_style: 'solid', bg_color: '#111827', layout: 'minimal', cta_square: true } },
    { label: 'Centered Bold', desc: 'Large headline, single CTA', props: { bg_style: 'minimal', layout: 'minimal', cta_square: false } },
    { label: 'With Eyebrow', desc: 'Eyebrow label + headline', props: { bg_style: 'minimal', layout: 'minimal', eyebrow_plain: true } },
  ],
  features: [
    { label: '3-Col Grid', desc: 'Classic 3-column cards', props: { layout: 'grid-3', columns: 3 } },
    { label: '4-Col Grid', desc: 'Compact 4-column grid', props: { layout: 'grid-4', columns: 4 } },
    { label: '2-Col Grid', desc: 'Wide two-column cards', props: { layout: 'grid-2', columns: 2 } },
    { label: 'Icon List', desc: 'Icon + text rows', props: { layout: 'list', columns: 1 } },
    { label: 'With Images', desc: 'Cards with photo headers', props: { layout: 'grid-3', columns: 3, show_images: true } },
  ],
  features_alternating: [
    { label: 'Image Left', desc: 'Photo left, text right', props: { image_position: 'left', layout: 'stacked' } },
    { label: 'Image Right', desc: 'Text left, photo right', props: { image_position: 'right', layout: 'stacked' } },
    { label: 'Stacked Rows', desc: 'Full-width stacked rows', props: { layout: 'stacked' } },
    { label: 'Wide Alternating', desc: 'Large images, bold titles', props: { image_position: 'left', layout: 'stacked', item_gap: 32 } },
  ],
  stats: [
    { label: '4 Stats Dark', desc: 'Dark background bar', props: { bg_style: 'dark', columns: 4 } },
    { label: '3 Stats Light', desc: 'Light cards on white', props: { bg_style: 'light', columns: 3 } },
    { label: '3 Stats Gradient', desc: 'Gradient background', props: { bg_style: 'gradient', columns: 3 } },
    { label: '4 Stats Minimal', desc: 'Simple numbers row', props: { bg_style: 'light', columns: 4 } },
  ],
  testimonials: [
    { label: '3-Col Cards', desc: 'Grid of review cards', props: { layout: 'grid', columns: 3 } },
    { label: 'Masonry', desc: 'Pinterest-style layout', props: { layout: 'masonry', columns: 2 } },
    { label: 'Centered Quote', desc: 'Single featured quote', props: { layout: 'centered', columns: 1 } },
    { label: '2-Col Large', desc: 'Bigger cards, two columns', props: { layout: 'grid', columns: 2 } },
  ],
  cta: [
    { label: 'Bold Gradient', desc: 'Brand gradient banner', props: { bg_style: 'gradient' } },
    { label: 'Dark Premium', desc: 'Dark background CTA', props: { bg_style: 'dark' } },
    { label: 'Light Minimal', desc: 'Light surface card', props: { bg_style: 'light' } },
    { label: 'Image Background', desc: 'Photo with overlay', props: { bg_style: 'image', overlay: true } },
  ],
  pricing: [
    { label: '3-Plan Standard', desc: 'Starter / Pro / Enterprise', props: { columns: 3, show_annual_toggle: true } },
    { label: '2-Plan Simple', desc: 'Two plans side by side', props: { columns: 2, show_annual_toggle: false } },
    { label: '3-Plan No Toggle', desc: 'Monthly pricing only', props: { columns: 3, show_annual_toggle: false } },
    { label: '2-Plan Highlight', desc: 'Featured middle plan', props: { columns: 2, show_annual_toggle: true } },
  ],
  team_grid: [
    { label: '4-Col Cards', desc: 'Compact team grid', props: { columns: 4, card_style: 'card' } },
    { label: '3-Col Large', desc: 'Larger photos', props: { columns: 3, card_style: 'card' } },
    { label: '5-Col Compact', desc: 'Many members per row', props: { columns: 5, card_style: 'minimal' } },
    { label: '2-Col Featured', desc: 'Large leadership cards', props: { columns: 2, card_style: 'card' } },
  ],
  nav: [
    { label: 'White Solid', desc: 'Classic white navigation', props: { nav_style: 'white' } },
    { label: 'Dark Bar', desc: 'Dark top navigation', props: { nav_style: 'dark' } },
    { label: 'Transparent', desc: 'Overlay on hero', props: { nav_style: 'transparent' } },
    { label: 'Brand Accent', desc: 'Primary color nav bar', props: { nav_style: 'brand' } },
  ],
  faq: [
    { label: 'Accordion', desc: 'Expandable Q&A', props: { layout: 'accordion' } },
    { label: 'Two Column', desc: 'Split FAQ columns', props: { layout: 'two-col', columns: 2 } },
    { label: 'Simple List', desc: 'Open list layout', props: { layout: 'list' } },
    { label: 'Compact Accordion', desc: 'Tighter spacing', props: { layout: 'accordion', compact: true } },
  ],
  contact_form: [
    { label: 'Split Layout', desc: 'Form + contact details', props: { layout: 'split', full_page: false } },
    { label: 'Full Page Form', desc: 'Centered form', props: { layout: 'centered', full_page: true } },
    { label: 'With Map', desc: 'Form above map', props: { layout: 'stacked', show_map: true } },
    { label: 'Form Only', desc: 'Simple centered form', props: { layout: 'centered', full_page: false } },
  ],
  footer: FOOTER_LAYOUT_PRESETS.map(p => ({
    label: p.label,
    desc: p.desc,
    props: { ...p.props },
  })),
  newsletter: [
    { label: 'Inline Bar', desc: 'Horizontal email bar', props: { layout: 'inline' } },
    { label: 'Centered Card', desc: 'Card with shadow', props: { layout: 'card' } },
    { label: 'Split Image', desc: 'Image + signup form', props: { layout: 'split' } },
    { label: 'Minimal Inline', desc: 'Compact single row', props: { layout: 'inline', compact: true } },
  ],
  gallery_masonry: [
    { label: 'Masonry Grid', desc: 'Pinterest-style gallery', props: { layout: 'masonry', columns: 3, image_shape: 'square' } },
    { label: 'Uniform Grid', desc: 'Even square grid', props: { layout: 'grid', columns: 4, image_shape: 'square' } },
    { label: 'Rounded Grid', desc: 'Soft rounded corners', props: { layout: 'grid', columns: 3, image_shape: 'rounded' } },
    { label: 'Circle Grid', desc: 'Circular photo tiles', props: { layout: 'grid', columns: 3, image_shape: 'circle' } },
    { label: 'Featured + Grid', desc: 'Large hero image + grid', props: { layout: 'featured', columns: 3, image_shape: 'rounded' } },
    { label: '2-Col Large', desc: 'Big photos, two columns', props: { layout: 'grid', columns: 2, image_shape: 'rounded' } },
  ],
  blog_grid: [
    { label: '3-Column Cards', desc: 'Standard blog grid', props: { columns: 3, card_style: 'card' } },
    { label: '2-Column Large', desc: 'Featured large cards', props: { columns: 2, card_style: 'large' } },
    { label: 'List View', desc: 'Horizontal post rows', props: { layout: 'list', columns: 1 } },
    { label: '4-Col Compact', desc: 'Dense post grid', props: { columns: 4, card_style: 'compact' } },
  ],
  about_split: [
    { label: 'Image Left', desc: 'Photo left, story right', props: { image_position: 'left' } },
    { label: 'Image Right', desc: 'Story left, photo right', props: { image_position: 'right' } },
    { label: 'Statement Center', desc: 'Centered text only', props: { layout: 'statement', variant: 'centered' } },
    { label: 'Full Width Image', desc: 'Large image + overlay text', props: { layout: 'overlay' } },
  ],
  services_cards: [
    { label: '3-Column Cards', desc: 'Service cards grid', props: { columns: 3, card_style: 'card' } },
    { label: '4-Column Compact', desc: 'Compact service grid', props: { columns: 4, card_style: 'compact' } },
    { label: 'List Rows', desc: 'Horizontal service rows', props: { layout: 'list', columns: 1 } },
    { label: '2-Col Large', desc: 'Large service cards', props: { columns: 2, card_style: 'card' } },
  ],
  product_grid: [
    { label: '4-Column Grid', desc: 'Standard product grid', props: { columns: 4, layout: 'grid' } },
    { label: '3-Column Featured', desc: 'Larger product cards', props: { columns: 3, card_style: 'large' } },
    { label: 'Editorial Spotlight', desc: 'Hero product + grid', props: { layout: 'editorial', columns: 3 } },
    { label: '2-Col Large', desc: 'Big product photos', props: { columns: 2, layout: 'grid' } },
  ],
  category_cards: [
    { label: 'Editorial 3-Col', desc: 'Shop-by-category editorial', props: { layout: 'editorial', columns: 3 } },
    { label: 'Square Grid', desc: 'Even category squares', props: { layout: 'grid', columns: 4 } },
    { label: 'Wide Banners', desc: 'Full-width category banners', props: { layout: 'banner', columns: 2 } },
    { label: '2-Col Large', desc: 'Large category tiles', props: { layout: 'grid', columns: 2 } },
  ],
  portfolio_grid: [
    { label: '3-Column Filterable', desc: 'Filter tabs + grid', props: { columns: 3, filterable: true } },
    { label: '2-Column Large', desc: 'Large project cards', props: { columns: 2, filterable: false } },
    { label: 'Masonry Portfolio', desc: 'Masonry project grid', props: { layout: 'masonry', columns: 3 } },
    { label: '4-Col Compact', desc: 'Dense portfolio grid', props: { columns: 4, filterable: true } },
  ],
  image_block: [
    { label: 'Full Width', desc: 'Edge-to-edge image', props: { layout: 'full' } },
    { label: 'Centered Frame', desc: 'Framed with caption', props: { layout: 'centered', show_caption: true } },
    { label: 'Split with Text', desc: 'Image + text side by side', props: { layout: 'split' } },
    { label: 'Rounded Card', desc: 'Card-style image', props: { layout: 'centered', show_caption: false } },
  ],
  booking_widget: [
    { label: 'Calendar View', desc: 'Month calendar picker', props: { show_calendar: true, layout: 'calendar' } },
    { label: 'Simple CTA', desc: 'Book now button', props: { show_calendar: false, layout: 'cta' } },
    { label: 'Inline Form', desc: 'Compact booking form', props: { layout: 'inline', show_calendar: true } },
    { label: 'Split Layout', desc: 'Details + calendar', props: { layout: 'split', show_calendar: true } },
  ],
  trust_logos: [
    { label: 'Logo Strip', desc: 'Horizontal partner logos', props: { layout: 'strip', grayscale: true } },
    { label: 'Color Logos', desc: 'Full-color partner row', props: { layout: 'strip', grayscale: false } },
    { label: 'Grid Logos', desc: 'Logo grid layout', props: { layout: 'grid', columns: 4 } },
  ],
  video_embed: [
    { label: '16:9 Standard', desc: 'Widescreen video', props: { aspect_ratio: '16:9' } },
    { label: 'Cinematic Wide', desc: 'Ultra-wide embed', props: { aspect_ratio: '21:9' } },
    { label: 'Square Social', desc: 'Square video frame', props: { aspect_ratio: '1:1' } },
  ],
  announcement_bar: [
    { label: 'Brand Green', desc: 'Primary color banner', props: { color: '#64C3A0', show_close: true } },
    { label: 'Dark Promo', desc: 'Dark announcement bar', props: { color: '#0f172a', show_close: true } },
    { label: 'Urgent Red', desc: 'Sale / urgency banner', props: { color: '#dc2626', show_close: false } },
    { label: 'Minimal Light', desc: 'Subtle gray bar', props: { color: '#f3f4f6', show_close: true } },
  ],
  rich_text: [
    { label: 'Standard', desc: 'Default text block', props: { layout: 'standard' } },
    { label: 'Narrow Column', desc: 'Readable narrow width', props: { layout: 'narrow', max_width: 'prose' } },
    { label: 'Wide Full', desc: 'Full-width content', props: { layout: 'wide' } },
  ],
  timeline: [
    { label: 'Vertical Steps', desc: 'Classic timeline', props: { layout: 'vertical' } },
    { label: 'Horizontal', desc: 'Horizontal milestone row', props: { layout: 'horizontal' } },
    { label: 'Compact List', desc: 'Simple step list', props: { layout: 'list' } },
  ],
  social_links: [
    { label: 'Icon Row', desc: 'Horizontal social icons', props: { layout: 'row' } },
    { label: 'Icon Grid', desc: 'Grid of social links', props: { layout: 'grid' } },
    { label: 'With Labels', desc: 'Icons + platform names', props: { layout: 'labeled' } },
  ],
}

export type SectionLayoutOption = {
  id: string
  label: string
  desc?: string
  props: Record<string, unknown>
}

export function getSectionLayoutOptions(blockType: string): SectionLayoutOption[] {
  const presets = BLOCK_QUICK_PRESETS[blockType]
  if (presets?.length) {
    return presets.map((p, i) => ({
      id: `${blockType}-${i}`,
      label: p.label,
      desc: p.desc,
      props: p.props,
    }))
  }
  if (blockType.includes('.')) {
    return [
      { id: `${blockType}-default`, label: 'Default', desc: 'Standard layout', props: { variant: 'default' } },
      { id: `${blockType}-compact`, label: 'Compact', desc: 'Space-efficient layout', props: { variant: 'compact' } },
      { id: `${blockType}-featured`, label: 'Featured', desc: 'Highlight style', props: { variant: 'featured' } },
      { id: `${blockType}-minimal`, label: 'Minimal', desc: 'Clean minimal style', props: { variant: 'minimal' } },
    ]
  }
  return [
    { id: `${blockType}-standard`, label: 'Standard', desc: 'Recommended default', props: {} },
    { id: `${blockType}-spacious`, label: 'Spacious', desc: 'Extra padding', props: { padding_top: 72, padding_bottom: 72 } },
    { id: `${blockType}-compact`, label: 'Compact', desc: 'Tighter spacing', props: { padding_top: 32, padding_bottom: 32 } },
    { id: `${blockType}-centered`, label: 'Centered', desc: 'Center-aligned content', props: { align: 'center' } },
  ]
}

/** True when block props match all layout-defining keys on a preset option. */
export function matchesSectionLayoutOption(
  currentProps: Record<string, unknown> | undefined,
  option: SectionLayoutOption,
): boolean {
  if (!currentProps) return false
  const keys = Object.keys(option.props)
  if (keys.length === 0) return false
  return keys.every(key => String(currentProps[key] ?? '') === String(option.props[key]))
}

/** Best-matching layout option for highlighting the current selection in the picker. */
export function findActiveSectionLayoutOption(
  currentProps: Record<string, unknown> | undefined,
  options: SectionLayoutOption[],
): SectionLayoutOption | undefined {
  if (!currentProps || options.length === 0) return undefined
  let best: SectionLayoutOption | undefined
  let bestScore = -1
  for (const opt of options) {
    const keys = Object.keys(opt.props)
    if (keys.length === 0) continue
    let score = 0
    for (const key of keys) {
      if (String(currentProps[key] ?? '') === String(opt.props[key])) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = opt
    }
  }
  if (!best || bestScore < Object.keys(best.props).length) return undefined
  return best
}
