/** Layout variants shown when adding a section from the builder catalog. */
import { FOOTER_LAYOUT_PRESETS } from '@/lib/footerLayoutTheme'
import { NAV_LAYOUT_PRESETS } from '@/lib/navLayoutTheme'

export type SectionLayoutPreset = {
  label: string
  desc?: string
  props: Record<string, unknown>
}

/** 10 commerce / library block layout variants (product.*, service.*, etc.). */
export const COMMERCE_VARIANT_PRESETS: SectionLayoutPreset[] = [
  { label: 'Classic Default', desc: 'Balanced spacing and clear hierarchy', props: { variant: 'default' } },
  { label: 'Compact Dense', desc: 'Space-efficient, tighter rows', props: { variant: 'compact' } },
  { label: 'Featured Spotlight', desc: 'Hero item with supporting details', props: { variant: 'featured' } },
  { label: 'Minimal Clean', desc: 'Whitespace-first, subtle borders', props: { variant: 'minimal' } },
  { label: 'Card Containers', desc: 'Elevated cards with soft shadow', props: { variant: 'card' } },
  { label: 'Split Columns', desc: 'Two-column balanced layout', props: { variant: 'split' } },
  { label: 'Editorial Wide', desc: 'Magazine-style bold typography', props: { variant: 'editorial' } },
  { label: 'List Rows', desc: 'Vertical stacked list items', props: { variant: 'list' } },
  { label: 'Grid Tiles', desc: 'Uniform responsive grid', props: { variant: 'grid' } },
  { label: 'Bold Hero', desc: 'Large headline with image backdrop', props: { variant: 'hero' } },
]

/** 10 generic spacing / alignment layouts for blocks without dedicated presets. */
export const GENERIC_SPACING_PRESETS: SectionLayoutPreset[] = [
  { label: 'Standard', desc: 'Recommended default spacing', props: { layout: 'standard', padding_top: 48, padding_bottom: 48, align: 'left' } },
  { label: 'Spacious', desc: 'Extra vertical breathing room', props: { layout: 'spacious', padding_top: 80, padding_bottom: 80, align: 'left' } },
  { label: 'Compact', desc: 'Tighter section padding', props: { layout: 'compact', padding_top: 32, padding_bottom: 32, align: 'left' } },
  { label: 'Centered', desc: 'Center-aligned content block', props: { layout: 'centered', padding_top: 56, padding_bottom: 56, align: 'center' } },
  { label: 'Wide Full', desc: 'Edge-to-edge full width', props: { layout: 'wide', padding_top: 48, padding_bottom: 48, align: 'left', max_width: 'full' } },
  { label: 'Narrow Column', desc: 'Readable prose-width column', props: { layout: 'narrow', padding_top: 48, padding_bottom: 48, align: 'left', max_width: 'prose' } },
  { label: 'Split Layout', desc: 'Two-column side-by-side', props: { layout: 'split', padding_top: 48, padding_bottom: 48, align: 'left' } },
  { label: 'Card Surface', desc: 'Content on elevated card', props: { layout: 'card', padding_top: 40, padding_bottom: 40, align: 'center', card_style: 'elevated' } },
  { label: 'Minimal Flat', desc: 'Flat, borderless minimal', props: { layout: 'minimal', padding_top: 24, padding_bottom: 24, align: 'left' } },
  { label: 'Bold Statement', desc: 'Large type, high contrast', props: { layout: 'statement', padding_top: 64, padding_bottom: 64, align: 'center', bg_style: 'dark' } },
]

export const BLOCK_QUICK_PRESETS: Record<string, SectionLayoutPreset[]> = {
  hero: [
    { label: 'Gradient Dark', desc: 'Violet/indigo gradient over image', props: { bg_style: 'gradient', gradient_preset: 'linear-gradient(135deg,#1e1b4b,#312e81,#6366f1)', overlay: true, layout: 'centered' } },
    { label: 'Image Full', desc: 'Full-bleed photo background', props: { bg_style: 'image', overlay: true, layout: 'centered' } },
    { label: 'Clean Light', desc: 'White minimal hero', props: { bg_style: 'minimal', overlay: false, layout: 'centered' } },
    { label: 'Dark Bold', desc: 'Dark dramatic hero', props: { bg_style: 'solid', bg_color: '#0f172a', overlay: true, layout: 'centered' } },
    { label: 'Brand Color', desc: 'Primary brand gradient', props: { bg_style: 'gradient', overlay: false, layout: 'centered' } },
    { label: 'Soft Surface', desc: 'Light gray background', props: { bg_style: 'minimal', bg_color: '#f8fafc', layout: 'centered' } },
    { label: 'Split Overlay', desc: 'Text left, image right overlay', props: { bg_style: 'image', overlay: true, layout: 'split', image_position: 'right' } },
    { label: 'Centered CTA', desc: 'Single bold headline + one button', props: { bg_style: 'gradient', overlay: false, layout: 'centered', cta_square: true } },
    { label: 'Video Backdrop', desc: 'Hero with dark video-style overlay', props: { bg_style: 'image', overlay: true, layout: 'centered', bg_color: '#000000' } },
    { label: 'Tagline', desc: 'Small text above headline', props: { bg_style: 'minimal', layout: 'centered', eyebrow_plain: true } },
  ],
  hero_split: [
    { label: 'Image Right', desc: 'Copy left, photo right', props: { bg_style: 'minimal', layout: 'split', image_position: 'right' } },
    { label: 'Image Left', desc: 'Photo left, copy right', props: { bg_style: 'minimal', layout: 'split', image_position: 'left' } },
    { label: 'Gradient Left', desc: 'Text left, gradient panel', props: { bg_style: 'gradient', layout: 'split' } },
    { label: 'White Clean', desc: 'Minimal split layout', props: { bg_style: 'minimal', layout: 'split' } },
    { label: 'Dark Split', desc: 'Dark text panel + image', props: { bg_style: 'solid', bg_color: '#0f172a', layout: 'split' } },
    { label: 'Brand Panel', desc: 'Brand color text side', props: { bg_style: 'solid', bg_color: '#64C3A0', layout: 'split', image_position: 'right' } },
    { label: 'Wide Image', desc: '60% image, 40% copy', props: { bg_style: 'minimal', layout: 'split', image_position: 'left', image_width: '60' } },
    { label: 'Stacked Mobile', desc: 'Image on top, text below', props: { bg_style: 'minimal', layout: 'stacked', image_position: 'top' } },
    { label: 'Overlap Card', desc: 'Image with overlapping text card', props: { bg_style: 'image', layout: 'overlap', overlay: true } },
    { label: 'Minimal Border', desc: 'Split with subtle divider', props: { bg_style: 'minimal', layout: 'split', show_divider: true } },
  ],
  hero_minimal: [
    { label: 'Clean Minimal', desc: 'Text-focused hero', props: { bg_style: 'minimal', layout: 'minimal' } },
    { label: 'Light Surface', desc: 'Soft gray background', props: { bg_style: 'light', layout: 'minimal' } },
    { label: 'Dark Statement', desc: 'Bold headline + square CTA', props: { bg_style: 'solid', bg_color: '#111827', layout: 'minimal', cta_square: true } },
    { label: 'Centered Bold', desc: 'Large headline, single CTA', props: { bg_style: 'minimal', layout: 'minimal', cta_square: false } },
    { label: 'With tagline', desc: 'Tagline + headline', props: { bg_style: 'minimal', layout: 'minimal', eyebrow_plain: true } },
    { label: 'Left Aligned', desc: 'Left-aligned minimal hero', props: { bg_style: 'minimal', layout: 'minimal', align: 'left' } },
    { label: 'Soft Gradient', desc: 'Subtle gradient background', props: { bg_style: 'gradient', layout: 'minimal' } },
    { label: 'Image Accent', desc: 'Small image beside headline', props: { bg_style: 'minimal', layout: 'minimal', show_image: true } },
    { label: 'Dual CTA', desc: 'Primary + secondary buttons', props: { bg_style: 'minimal', layout: 'minimal', cta_secondary: 'Learn more' } },
    { label: 'Ultra Compact', desc: 'Slim height, tight spacing', props: { bg_style: 'minimal', layout: 'minimal', padding_top: 32, padding_bottom: 32 } },
  ],
  features: [
    { label: '3-Col Grid', desc: 'Classic 3-column cards', props: { layout: 'grid-3', columns: 3 } },
    { label: '4-Col Grid', desc: 'Compact 4-column grid', props: { layout: 'grid-4', columns: 4 } },
    { label: '2-Col Grid', desc: 'Wide two-column cards', props: { layout: 'grid-2', columns: 2 } },
    { label: 'Icon List', desc: 'Icon + text rows', props: { layout: 'list', columns: 1 } },
    { label: 'With Images', desc: 'Cards with photo headers', props: { layout: 'grid-3', columns: 3, show_images: true } },
    { label: 'Bordered Cards', desc: 'Outlined card containers', props: { layout: 'grid-3', columns: 3, card_style: 'bordered' } },
    { label: 'Centered Icons', desc: 'Icons above centered text', props: { layout: 'grid-3', columns: 3, icon_position: 'top' } },
    { label: 'Horizontal Strip', desc: 'Single row of features', props: { layout: 'strip', columns: 4 } },
    { label: 'Masonry Cards', desc: 'Staggered card heights', props: { layout: 'masonry', columns: 3 } },
    { label: 'Dark Surface', desc: 'Features on dark background', props: { layout: 'grid-3', columns: 3, bg_style: 'dark' } },
  ],
  features_alternating: [
    { label: 'Image Left', desc: 'Square photo left, text right', props: { image_position: 'left', layout: 'stacked', image_shape: 'square' } },
    { label: 'Image Right', desc: 'Square photo right, text left', props: { image_position: 'right', layout: 'stacked', image_shape: 'square' } },
    { label: 'Circle Frames', desc: 'Circular photos with soft glow', props: { layout: 'stacked', image_shape: 'circle' } },
    { label: 'Rounded Cards', desc: 'Rounded images in bordered cards', props: { layout: 'stacked', image_shape: 'rounded', card_style: 'card' } },
    { label: 'Wide Alternating', desc: 'Large rounded images, bold titles', props: { image_position: 'left', layout: 'stacked', image_shape: 'rounded', item_gap: 32 } },
    { label: 'Compact Circles', desc: 'Small circular crops, tight spacing', props: { layout: 'stacked', image_shape: 'circle', item_gap: 16, compact: true } },
    { label: 'Numbered Steps', desc: 'Step numbers beside each row', props: { layout: 'stacked', show_numbers: true, image_shape: 'rounded' } },
    { label: 'Full Bleed', desc: 'Edge-to-edge square photos', props: { layout: 'full', image_shape: 'square', image_position: 'left' } },
    { label: 'Icon Rows', desc: 'Animated icon circles — no photos', props: { layout: 'stacked', use_icons: true } },
    { label: 'Dark Alternating', desc: 'Dark surface + rounded images', props: { layout: 'stacked', bg_style: 'dark', image_shape: 'rounded' } },
  ],
  stats: [
    { label: '4 Stats Dark', desc: 'Dark background bar', props: { bg_style: 'dark', columns: 4 } },
    { label: '3 Stats Light', desc: 'Light cards on white', props: { bg_style: 'light', columns: 3 } },
    { label: '3 Stats Gradient', desc: 'Gradient background', props: { bg_style: 'gradient', columns: 3 } },
    { label: '4 Stats Minimal', desc: 'Simple numbers row', props: { bg_style: 'light', columns: 4 } },
    { label: '2 Stats Bold', desc: 'Two large hero numbers', props: { bg_style: 'dark', columns: 2 } },
    { label: '5 Stats Compact', desc: 'Five metrics in a row', props: { bg_style: 'light', columns: 5 } },
    { label: 'Card Stats', desc: 'Each stat in its own card', props: { bg_style: 'light', columns: 4, card_style: 'card' } },
    { label: 'Brand Bar', desc: 'Primary color stat bar', props: { bg_style: 'brand', columns: 4 } },
    { label: 'With Dividers', desc: 'Vertical dividers between stats', props: { bg_style: 'light', columns: 4, show_dividers: true } },
    { label: 'Image Overlay', desc: 'Stats over background photo', props: { bg_style: 'image', columns: 4, overlay: true } },
  ],
  testimonials: [
    { label: '3-Col Cards', desc: 'Grid of review cards', props: { layout: 'grid', columns: 3 } },
    { label: 'Masonry', desc: 'Pinterest-style layout', props: { layout: 'masonry', columns: 2 } },
    { label: 'Centered Quote', desc: 'Single featured quote', props: { layout: 'centered', columns: 1 } },
    { label: '2-Col Large', desc: 'Bigger cards, two columns', props: { layout: 'grid', columns: 2 } },
    { label: 'Carousel Strip', desc: 'Horizontal scrolling quotes', props: { layout: 'carousel', columns: 1 } },
    { label: 'Star Rating Row', desc: 'Compact star + quote rows', props: { layout: 'list', columns: 1 } },
    { label: 'Photo Cards', desc: 'Large avatar photo cards', props: { layout: 'grid', columns: 3, show_photos: true } },
    { label: 'Dark Cards', desc: 'Reviews on dark surface', props: { layout: 'grid', columns: 3, bg_style: 'dark' } },
    { label: 'Quote + Logo', desc: 'Quote with company logo', props: { layout: 'centered', columns: 1, show_logo: true } },
    { label: '4-Col Compact', desc: 'Four small review cards', props: { layout: 'grid', columns: 4, card_style: 'compact' } },
  ],
  cta: [
    { label: 'Bold Gradient', desc: 'Brand gradient banner', props: { bg_style: 'gradient' } },
    { label: 'Dark Premium', desc: 'Dark background CTA', props: { bg_style: 'dark' } },
    { label: 'Light Minimal', desc: 'Light surface card', props: { bg_style: 'light' } },
    { label: 'Image Background', desc: 'Photo with overlay', props: { bg_style: 'image', overlay: true } },
    { label: 'Split CTA', desc: 'Text left, button right', props: { bg_style: 'gradient', layout: 'split' } },
    { label: 'Centered Card', desc: 'CTA inside bordered card', props: { bg_style: 'light', layout: 'card' } },
    { label: 'Brand Solid', desc: 'Primary color full bar', props: { bg_style: 'brand' } },
    { label: 'Dual Buttons', desc: 'Primary + secondary actions', props: { bg_style: 'dark', cta_secondary: 'Learn more' } },
    { label: 'Compact Bar', desc: 'Slim inline CTA strip', props: { bg_style: 'gradient', compact: true } },
    { label: 'Newsletter Style', desc: 'Headline + email field', props: { bg_style: 'light', show_email: true } },
  ],
  pricing: [
    { label: '3-Plan Standard', desc: 'Starter / Pro / Enterprise', props: { columns: 3, show_annual_toggle: true } },
    { label: '2-Plan Simple', desc: 'Two plans side by side', props: { columns: 2, show_annual_toggle: false } },
    { label: '3-Plan No Toggle', desc: 'Monthly pricing only', props: { columns: 3, show_annual_toggle: false } },
    { label: '2-Plan Highlight', desc: 'Featured middle plan', props: { columns: 2, highlight_middle: true, show_annual_toggle: true } },
    { label: '4-Plan Grid', desc: 'Four tier comparison', props: { columns: 4, show_annual_toggle: false } },
    { label: 'Single Featured', desc: 'One highlighted plan card', props: { columns: 1, show_annual_toggle: false } },
    { label: 'Dark Pricing', desc: 'Plans on dark background', props: { columns: 3, bg_style: 'dark', show_annual_toggle: true } },
    { label: 'Compact Table', desc: 'Tighter plan cards', props: { columns: 3, card_style: 'compact', show_annual_toggle: true } },
    { label: 'Horizontal Compare', desc: 'Plans in a horizontal row', props: { columns: 3, layout: 'horizontal', show_annual_toggle: true } },
    { label: 'Enterprise Focus', desc: 'Highlight custom enterprise tier', props: { columns: 3, highlight_last: true, show_annual_toggle: true } },
  ],
  team_grid: [
    { label: '4-Col Cards', desc: 'Compact team grid', props: { columns: 4, card_style: 'card' } },
    { label: '3-Col Large', desc: 'Larger photos', props: { columns: 3, card_style: 'card' } },
    { label: '5-Col Compact', desc: 'Many members per row', props: { columns: 5, card_style: 'minimal' } },
    { label: '2-Col Featured', desc: 'Large leadership cards', props: { columns: 2, card_style: 'card' } },
    { label: 'Circle Avatars', desc: 'Round photo avatars', props: { columns: 4, image_shape: 'circle' } },
    { label: 'List Bios', desc: 'Photo + bio list rows', props: { columns: 1, layout: 'list' } },
    { label: 'Hover Cards', desc: 'Reveal bio on hover', props: { columns: 3, card_style: 'hover' } },
    { label: 'Dark Grid', desc: 'Team on dark background', props: { columns: 4, bg_style: 'dark' } },
    { label: 'Minimal Names', desc: 'Name and role only', props: { columns: 5, card_style: 'minimal' } },
    { label: 'Leadership Row', desc: 'Executives in single row', props: { columns: 3, layout: 'strip' } },
  ],
  nav: NAV_LAYOUT_PRESETS.map(p => ({
    label: p.label,
    desc: p.desc,
    props: { ...p.props },
  })),
  faq: [
    { label: 'Accordion', desc: 'Expandable Q&A', props: { layout: 'accordion' } },
    { label: 'Two Column', desc: 'Split FAQ columns', props: { layout: 'two-col', columns: 2 } },
    { label: 'Simple List', desc: 'Open list layout', props: { layout: 'list' } },
    { label: 'Compact Accordion', desc: 'Tighter spacing', props: { layout: 'accordion', compact: true } },
    { label: 'Bordered Accordion', desc: 'Outlined accordion items', props: { layout: 'accordion', card_style: 'bordered' } },
    { label: '3-Col Grid', desc: 'FAQ in three columns', props: { layout: 'grid', columns: 3 } },
    { label: 'Numbered FAQ', desc: 'Numbered question list', props: { layout: 'list', show_numbers: true } },
    { label: 'Dark Accordion', desc: 'Accordion on dark surface', props: { layout: 'accordion', bg_style: 'dark' } },
    { label: 'Side by Side', desc: 'Title left, questions right', props: { layout: 'split' } },
    { label: 'Card FAQ', desc: 'Each Q&A in a card', props: { layout: 'accordion', card_style: 'card' } },
  ],
  contact_form: [
    { label: 'Split Layout', desc: 'Form + contact details', props: { layout: 'split', full_page: false } },
    { label: 'Full Page Form', desc: 'Centered form', props: { layout: 'centered', full_page: true } },
    { label: 'With Map', desc: 'Form above map', props: { layout: 'stacked', show_map: true } },
    { label: 'Form Only', desc: 'Simple centered form', props: { layout: 'centered', full_page: false } },
    { label: 'Dark Form', desc: 'Form on dark background', props: { layout: 'centered', bg_style: 'dark' } },
    { label: 'Card Form', desc: 'Form inside elevated card', props: { layout: 'card', full_page: false } },
    { label: 'Inline Fields', desc: 'Horizontal compact fields', props: { layout: 'inline', full_page: false } },
    { label: 'Image Split', desc: 'Photo left, form right', props: { layout: 'split', image_position: 'left' } },
    { label: 'Two Column Fields', desc: 'Form fields in two columns', props: { layout: 'centered', columns: 2 } },
    { label: 'Minimal Contact', desc: 'Email + message only', props: { layout: 'minimal', full_page: false } },
  ],
  footer: [
    ...FOOTER_LAYOUT_PRESETS.map(p => ({
      label: p.label,
      desc: p.desc,
      props: { ...p.props },
    })),
    { label: 'Dark Minimal', desc: 'Dark centered minimal footer', props: { footer_style: 'minimal', columns: 1, show_social: false, footer_bg: '#0f172a', footer_heading: '#f8fafc', footer_muted: '#94a3b8', footer_border: '#334155' } },
    { label: 'Brand Compact', desc: 'Brand color, two columns', props: { footer_style: 'compact', columns: 2, show_social: true, footer_bg: '#64C3A0', footer_heading: '#ffffff', footer_muted: 'rgba(255,255,255,0.85)', footer_border: 'rgba(255,255,255,0.2)' } },
    { label: 'Mega Dark', desc: 'Dark mega footer + newsletter', props: { footer_style: 'mega', columns: 4, show_newsletter: true, show_social: true, footer_bg: '#0f172a', footer_heading: '#f8fafc', footer_muted: '#94a3b8', footer_border: '#334155' } },
  ],
  newsletter: [
    { label: 'Inline Bar', desc: 'Horizontal email bar', props: { layout: 'inline' } },
    { label: 'Centered Card', desc: 'Card with shadow', props: { layout: 'card' } },
    { label: 'Split Image', desc: 'Image + signup form', props: { layout: 'split' } },
    { label: 'Minimal Inline', desc: 'Compact single row', props: { layout: 'inline', compact: true } },
    { label: 'Dark Bar', desc: 'Newsletter on dark bg', props: { layout: 'inline', bg_style: 'dark' } },
    { label: 'Brand Gradient', desc: 'Gradient signup banner', props: { layout: 'card', bg_style: 'gradient' } },
    { label: 'Stacked Center', desc: 'Headline above input', props: { layout: 'stacked', align: 'center' } },
    { label: 'Side by Side', desc: 'Copy left, form right', props: { layout: 'split', image_position: 'none' } },
    { label: 'Floating Card', desc: 'Elevated card on image', props: { layout: 'card', overlay: true } },
    { label: 'Footer Style', desc: 'Subtle footer newsletter row', props: { layout: 'inline', compact: true, bg_style: 'light' } },
  ],
  gallery_masonry: [
    { label: 'Masonry Grid', desc: 'Pinterest-style gallery', props: { layout: 'masonry', columns: 3, image_shape: 'square' } },
    { label: 'Uniform Grid', desc: 'Even square grid', props: { layout: 'grid', columns: 4, image_shape: 'square' } },
    { label: 'Rounded Grid', desc: 'Soft rounded corners', props: { layout: 'grid', columns: 3, image_shape: 'rounded' } },
    { label: 'Circle Grid', desc: 'Circular photo tiles', props: { layout: 'grid', columns: 3, image_shape: 'circle' } },
    { label: 'Featured + Grid', desc: 'Large hero image + grid', props: { layout: 'featured', columns: 3, image_shape: 'rounded' } },
    { label: '2-Col Large', desc: 'Big photos, two columns', props: { layout: 'grid', columns: 2, image_shape: 'rounded' } },
    { label: 'Justified Row', desc: 'Equal-height photo row', props: { layout: 'justified', columns: 4 } },
    { label: 'Polaroid Stack', desc: 'Rotated polaroid-style frames', props: { layout: 'polaroid', columns: 3 } },
    { label: 'Dark Gallery', desc: 'Gallery on dark background', props: { layout: 'grid', columns: 3, bg_style: 'dark' } },
    { label: 'Lightbox Grid', desc: 'Click-to-expand grid tiles', props: { layout: 'grid', columns: 3, lightbox: true } },
  ],
  video_gallery: [
    { label: 'Uniform Grid', desc: 'Even video grid', props: { layout: 'grid', columns: 3, image_shape: 'rounded' } },
    { label: 'Masonry Grid', desc: 'Pinterest-style video wall', props: { layout: 'masonry', columns: 3, image_shape: 'rounded' } },
    { label: 'Featured + Grid', desc: 'Large hero video + grid', props: { layout: 'featured', columns: 3, image_shape: 'rounded' } },
    { label: '2-Col Large', desc: 'Big players, two columns', props: { layout: 'grid', columns: 2, image_shape: 'rounded' } },
    { label: '4-Col Compact', desc: 'Dense video grid', props: { layout: 'grid', columns: 4, image_shape: 'square' } },
    { label: 'Square Grid', desc: 'Square video tiles', props: { layout: 'grid', columns: 3, image_shape: 'square' } },
    { label: 'Circle Grid', desc: 'Circular video thumbnails', props: { layout: 'grid', columns: 3, image_shape: 'circle' } },
    { label: 'Dark Gallery', desc: 'Videos on dark background', props: { layout: 'grid', columns: 3, bg_style: 'dark' } },
    { label: 'Lightbox Grid', desc: 'Click-to-expand players', props: { layout: 'grid', columns: 3, lightbox: true } },
    { label: 'Wide Featured', desc: 'Hero video with side tiles', props: { layout: 'featured', columns: 3, image_shape: 'square' } },
  ],
  blog_grid: [
    { label: '3-Column Cards', desc: 'Standard blog grid', props: { columns: 3, card_style: 'card' } },
    { label: '2-Column Large', desc: 'Featured large cards', props: { columns: 2, card_style: 'large' } },
    { label: 'List View', desc: 'Horizontal post rows', props: { layout: 'list', columns: 1 } },
    { label: '4-Col Compact', desc: 'Dense post grid', props: { columns: 4, card_style: 'compact' } },
    { label: 'Magazine Layout', desc: 'Featured post + grid', props: { layout: 'magazine', columns: 3 } },
    { label: 'Minimal List', desc: 'Title + date rows only', props: { layout: 'list', card_style: 'minimal' } },
    { label: 'Photo Cards', desc: 'Large thumbnail cards', props: { columns: 2, card_style: 'photo' } },
    { label: 'Dark Blog', desc: 'Posts on dark surface', props: { columns: 3, bg_style: 'dark' } },
    { label: 'Timeline Posts', desc: 'Vertical timeline list', props: { layout: 'timeline', columns: 1 } },
    { label: 'Carousel Posts', desc: 'Horizontal post carousel', props: { layout: 'carousel', columns: 1 } },
  ],
  about_split: [
    { label: 'Image Right', desc: 'Story left, photo right', props: { layout: 'split', image_position: 'right' } },
    { label: 'Image Left', desc: 'Photo left, story right', props: { layout: 'split', image_position: 'left' } },
    { label: 'Statement Center', desc: 'Centered text only', props: { layout: 'statement', variant: 'centered', image_position: 'none' } },
    { label: 'Full Width Image', desc: 'Large image + overlay text', props: { layout: 'overlay', image_position: 'background' } },
    { label: 'Two Column Text', desc: 'Split text columns', props: { layout: 'columns', image_position: 'none' } },
    { label: 'Stats + Story', desc: 'About with inline stats', props: { layout: 'split', image_position: 'left', show_stats: true } },
    { label: 'Video About', desc: 'Video embed beside story', props: { layout: 'split', image_position: 'right', media_type: 'video' } },
    { label: 'Dark About', desc: 'About section on dark bg', props: { layout: 'split', image_position: 'left', bg_style: 'dark' } },
    { label: 'Card About', desc: 'Content in bordered card', props: { layout: 'split', image_position: 'left', card_style: 'card' } },
    { label: 'Full Bleed Photo', desc: 'Edge-to-edge photo + text', props: { layout: 'full', image_position: 'background' } },
  ],
  services_cards: [
    { label: '3-Column Cards', desc: 'Service cards grid', props: { columns: 3, card_style: 'card' } },
    { label: '4-Column Compact', desc: 'Compact service grid', props: { columns: 4, card_style: 'compact' } },
    { label: 'List Rows', desc: 'Horizontal service rows', props: { layout: 'list', columns: 1 } },
    { label: '2-Col Large', desc: 'Large service cards', props: { columns: 2, card_style: 'card' } },
    { label: 'Icon Grid', desc: 'Icon-led service cards', props: { columns: 3, show_icons: true } },
    { label: 'Pricing Cards', desc: 'Services with price tags', props: { columns: 3, show_price: true } },
    { label: 'Dark Services', desc: 'Services on dark background', props: { columns: 3, bg_style: 'dark' } },
    { label: 'Bordered List', desc: 'Outlined list rows', props: { layout: 'list', card_style: 'bordered' } },
    { label: 'Featured Service', desc: 'One hero + supporting grid', props: { layout: 'featured', columns: 3 } },
    { label: 'Carousel Services', desc: 'Horizontal service carousel', props: { layout: 'carousel', columns: 1 } },
  ],
  product_grid: [
    { label: '4-Column Grid', desc: 'Standard product grid', props: { columns: 4, layout: 'grid' } },
    { label: '3-Column Featured', desc: 'Larger product cards', props: { columns: 3, card_style: 'large' } },
    { label: 'Editorial Spotlight', desc: 'Hero product + grid', props: { layout: 'editorial', columns: 3 } },
    { label: '2-Col Large', desc: 'Big product photos', props: { columns: 2, layout: 'grid' } },
    { label: 'List View', desc: 'Product rows with details', props: { layout: 'list', columns: 1 } },
    { label: 'Compact 5-Col', desc: 'Dense product grid', props: { columns: 5, card_style: 'compact' } },
    { label: 'Carousel Row', desc: 'Horizontal product scroll', props: { layout: 'carousel', columns: 1 } },
    { label: 'Sale Badges', desc: 'Grid with promo badges', props: { columns: 4, show_badges: true } },
    { label: 'Minimal Cards', desc: 'Image + title only', props: { columns: 4, card_style: 'minimal' } },
    { label: 'Dark Shop Grid', desc: 'Products on dark surface', props: { columns: 4, bg_style: 'dark' } },
  ],
  product_detail: [
    { label: 'Classic Split', desc: 'Photo left, details right', props: { layout: 'split', image_position: 'left' } },
    { label: 'Details Left', desc: 'Details left, photo right', props: { layout: 'split', image_position: 'right' } },
    { label: 'Gallery Stacked', desc: 'Large photo above details', props: { layout: 'stacked' } },
    { label: 'Minimal Clean', desc: 'Whitespace-first, no badges', props: { layout: 'minimal', image_position: 'left' } },
    { label: 'Bordered Card', desc: 'Product inside elevated card', props: { layout: 'card', image_position: 'left' } },
    { label: 'Dark Premium', desc: 'Details on dark surface', props: { layout: 'split', image_position: 'left', bg_style: 'dark' } },
    { label: 'Spotlight Hero', desc: 'Full-bleed photo with overlay', props: { layout: 'hero' } },
  ],
  'product.categories': [
    { label: '4-Column Grid', desc: 'Standard category grid', props: { variant: 'grid', layout: 'grid', columns: 4 } },
    { label: '3-Column Grid', desc: 'Balanced showcase grid', props: { variant: 'grid', layout: 'grid', columns: 3 } },
    { label: '2-Col Large', desc: 'Big category tiles', props: { variant: 'grid', layout: 'grid', columns: 2, image_height_pct: 110 } },
    { label: 'Carousel Row', desc: 'Horizontal scrolling cards', props: { variant: 'carousel', layout: 'carousel', columns: 4 } },
    { label: 'Horizontal Strip', desc: 'Compact scrolling row', props: { variant: 'carousel', layout: 'strip', columns: 6 } },
    { label: 'Wide Banners', desc: 'Full-width banner tiles', props: { variant: 'grid', layout: 'banner', columns: 2 } },
    { label: 'Overlay Cards', desc: 'Photo with text overlay', props: { variant: 'grid', layout: 'overlay', columns: 3 } },
    { label: 'Compact Grid', desc: 'Dense small tiles', props: { variant: 'grid', layout: 'compact', columns: 5 } },
    { label: 'Minimal List', desc: 'Text-only category links', props: { variant: 'grid', layout: 'list', columns: 1 } },
    { label: 'Dark Showcase', desc: 'Categories on dark background', props: { variant: 'grid', layout: 'grid', columns: 3, bg_style: 'dark' } },
  ],
  category_cards: [
    { label: 'Category Explorer', desc: 'Tap a category to reveal its products here', props: { layout: 'grid', columns: 3, interaction_mode: 'expand' } },
    { label: 'Wellness Mosaic', desc: 'Animated mix of circles, squares & portraits', props: { layout: 'wellness', columns: 3, interaction_mode: 'expand' } },
    { label: 'Editorial 3-Col', desc: 'Shop-by-category editorial', props: { layout: 'editorial', columns: 3 } },
    { label: 'Square Grid', desc: 'Even category squares', props: { layout: 'grid', columns: 4 } },
    { label: 'Wide Banners', desc: 'Full-width category banners', props: { layout: 'banner', columns: 2 } },
    { label: '2-Col Large', desc: 'Large category tiles', props: { layout: 'grid', columns: 2 } },
    { label: 'Circle Categories', desc: 'Round category icons', props: { layout: 'grid', columns: 5, image_shape: 'circle' } },
    { label: 'Overlay Text', desc: 'Photo with text overlay', props: { layout: 'overlay', columns: 3 } },
    { label: 'Horizontal Strip', desc: 'Scrolling category row', props: { layout: 'strip', columns: 6 } },
    { label: 'Masonry Categories', desc: 'Staggered category tiles', props: { layout: 'masonry', columns: 3 } },
    { label: 'Dark Categories', desc: 'Categories on dark bg', props: { layout: 'grid', columns: 4, bg_style: 'dark' } },
    { label: 'Minimal Labels', desc: 'Text-only category links', props: { layout: 'list', columns: 1 } },
  ],
  portfolio_grid: [
    { label: '3-Column Filterable', desc: 'Filter tabs + grid', props: { columns: 3, filterable: true } },
    { label: '2-Column Large', desc: 'Large project cards', props: { columns: 2, filterable: false } },
    { label: 'Masonry Portfolio', desc: 'Masonry project grid', props: { layout: 'masonry', columns: 3 } },
    { label: '4-Col Compact', desc: 'Dense portfolio grid', props: { columns: 4, filterable: true } },
    { label: 'Hover Reveal', desc: 'Title on hover overlay', props: { columns: 3, hover_reveal: true } },
    { label: 'Full Width Rows', desc: 'Full-bleed project rows', props: { layout: 'full', columns: 1 } },
    { label: 'Carousel Projects', desc: 'Horizontal project scroll', props: { layout: 'carousel', columns: 1 } },
    { label: 'Dark Portfolio', desc: 'Projects on dark surface', props: { columns: 3, bg_style: 'dark' } },
    { label: 'List + Thumbnail', desc: 'List with small thumbnails', props: { layout: 'list', columns: 1 } },
    { label: 'Featured + Grid', desc: 'Hero project + grid', props: { layout: 'featured', columns: 3 } },
  ],
  image_block: [
    { label: 'Full Width', desc: 'Edge-to-edge image', props: { layout: 'full' } },
    { label: 'Centered Frame', desc: 'Framed with caption', props: { layout: 'centered', show_caption: true } },
    { label: 'Split with Text', desc: 'Image + text side by side', props: { layout: 'split' } },
    { label: 'Rounded Card', desc: 'Card-style image', props: { layout: 'centered', show_caption: false } },
    { label: 'Circle Portrait', desc: 'Circular cropped image', props: { layout: 'centered', image_shape: 'circle' } },
    { label: 'Polaroid Frame', desc: 'Polaroid-style frame', props: { layout: 'polaroid', show_caption: true } },
    { label: 'Overlap Text', desc: 'Caption overlay on image', props: { layout: 'overlay', show_caption: true } },
    { label: 'Two Up', desc: 'Two images side by side', props: { layout: 'duo', columns: 2 } },
    { label: 'Dark Frame', desc: 'Image on dark background', props: { layout: 'centered', bg_style: 'dark' } },
    { label: 'Parallax Wide', desc: 'Wide cinematic crop', props: { layout: 'full', aspect_ratio: '21:9' } },
  ],
  'booking.wizard': [
    { label: 'Horizontal Steps', desc: 'Progress bar with labels across the top', props: { variant: 'horizontal', layout: 'horizontal', showLabels: true } },
    { label: 'Horizontal Compact', desc: 'Step circles only, no labels', props: { variant: 'horizontal-compact', layout: 'horizontal', showLabels: false } },
    { label: 'Vertical Steps', desc: 'Stacked step list with descriptions', props: { variant: 'vertical', layout: 'vertical', showLabels: true } },
    { label: 'Vertical Compact', desc: 'Stacked step list, numbers only', props: { variant: 'vertical-compact', layout: 'vertical', showLabels: false } },
  ],
  'booking.resource': [
    { label: 'Grid Cards', desc: 'Two-column cards with description & features', props: { variant: 'grid', layout: 'grid', showFeatures: true, showPrice: true } },
    { label: 'List Rows', desc: 'Dense single-column rows', props: { variant: 'list', layout: 'list', showFeatures: true, showPrice: true } },
    { label: 'Compact Grid', desc: 'Small cards, name & price only', props: { variant: 'compact', layout: 'compact', showFeatures: false, showPrice: true } },
  ],
  'service.process': [
    { label: 'Horizontal', desc: 'Numbered steps in a row with connector lines', props: { variant: 'horizontal', layout: 'horizontal' } },
    { label: 'Vertical', desc: 'Stacked steps with descriptions beside each number', props: { variant: 'vertical', layout: 'vertical' } },
    { label: 'Cards', desc: 'Numbered steps inside bordered cards', props: { variant: 'cards', layout: 'cards' } },
  ],
  'service.team': [
    { label: 'Grid', desc: 'Cards in a 3-column grid with bio and rating', props: { variant: 'grid', layout: 'grid' } },
    { label: 'List', desc: 'Single-column rows, avatar left and details right', props: { variant: 'list', layout: 'list' } },
    { label: 'Compact', desc: 'Small avatar chips with a summary panel below', props: { variant: 'compact', layout: 'compact' } },
  ],
  booking_widget: [
    { label: 'Calendar View', desc: 'Month calendar picker', props: { show_calendar: true, layout: 'calendar' } },
    { label: 'Simple CTA', desc: 'Book now button', props: { show_calendar: false, layout: 'cta' } },
    { label: 'Inline Form', desc: 'Compact booking form', props: { layout: 'inline', show_calendar: true } },
    { label: 'Split Layout', desc: 'Details + calendar', props: { layout: 'split', show_calendar: true } },
    { label: 'Card Booking', desc: 'Booking inside card', props: { layout: 'card', show_calendar: true } },
    { label: 'Dark Calendar', desc: 'Calendar on dark surface', props: { layout: 'calendar', bg_style: 'dark', show_calendar: true } },
    { label: 'Step Wizard', desc: 'Multi-step booking flow', props: { layout: 'wizard', show_calendar: true } },
    { label: 'Time Slots', desc: 'Grid of time slot buttons', props: { layout: 'slots', show_calendar: false } },
    { label: 'Sidebar Book', desc: 'Sticky sidebar booking', props: { layout: 'sidebar', show_calendar: true } },
    { label: 'Minimal CTA', desc: 'Single book button + text', props: { layout: 'minimal', show_calendar: false } },
  ],
  trust_logos: [
    { label: 'Logo Strip', desc: 'Horizontal partner logos', props: { layout: 'strip', grayscale: true } },
    { label: 'Color Logos', desc: 'Full-color partner row', props: { layout: 'strip', grayscale: false } },
    { label: 'Grid Logos', desc: 'Logo grid layout', props: { layout: 'grid', columns: 4 } },
    { label: 'Marquee Scroll', desc: 'Auto-scrolling logo row', props: { layout: 'marquee', grayscale: true } },
    { label: '2-Row Grid', desc: 'Two rows of logos', props: { layout: 'grid', columns: 5 } },
    { label: 'Dark Strip', desc: 'Logos on dark background', props: { layout: 'strip', bg_style: 'dark', grayscale: false } },
    { label: 'Card Logos', desc: 'Logos inside bordered card', props: { layout: 'card', columns: 4 } },
    { label: 'Large Featured', desc: 'Fewer, larger logos', props: { layout: 'strip', columns: 3, size: 'large' } },
    { label: 'With Heading', desc: 'Title above logo row', props: { layout: 'strip', show_title: true } },
    { label: 'Minimal Gray', desc: 'Subtle gray logo strip', props: { layout: 'strip', grayscale: true, compact: true } },
  ],
  video_embed: [
    { label: '16:9 Standard', desc: 'Widescreen video', props: { aspect_ratio: '16:9' } },
    { label: 'Cinematic Wide', desc: 'Ultra-wide embed', props: { aspect_ratio: '21:9' } },
    { label: 'Square Social', desc: 'Square video frame', props: { aspect_ratio: '1:1' } },
    { label: '4:3 Classic', desc: 'Classic TV aspect ratio', props: { aspect_ratio: '4:3' } },
    { label: 'Vertical Reel', desc: '9:16 mobile-style video', props: { aspect_ratio: '9:16' } },
    { label: 'Full Bleed', desc: 'Edge-to-edge video', props: { aspect_ratio: '16:9', layout: 'full' } },
    { label: 'Card Frame', desc: 'Video in rounded card', props: { aspect_ratio: '16:9', layout: 'card' } },
    { label: 'Split + Text', desc: 'Video beside description', props: { aspect_ratio: '16:9', layout: 'split' } },
    { label: 'Dark Theater', desc: 'Video on dark background', props: { aspect_ratio: '16:9', bg_style: 'dark' } },
    { label: 'Minimal Play', desc: 'Small centered player', props: { aspect_ratio: '16:9', layout: 'minimal' } },
  ],
  announcement_bar: [
    { label: 'Brand Green', desc: 'Primary color banner', props: { color: '#64C3A0', show_close: true } },
    { label: 'Dark Promo', desc: 'Dark announcement bar', props: { color: '#0f172a', show_close: true } },
    { label: 'Urgent Red', desc: 'Sale / urgency banner', props: { color: '#dc2626', show_close: false } },
    { label: 'Minimal Light', desc: 'Subtle gray bar', props: { color: '#f3f4f6', show_close: true } },
    { label: 'Brand Orange', desc: 'Warm accent promo bar', props: { color: '#f97316', show_close: true } },
    { label: 'Purple Sale', desc: 'Bold purple promotion', props: { color: '#7c3aed', show_close: true } },
    { label: 'Black Friday', desc: 'High-contrast black bar', props: { color: '#000000', show_close: false } },
    { label: 'Soft Blue', desc: 'Calm info announcement', props: { color: '#3b82f6', show_close: true } },
    { label: 'No Close Icon', desc: 'Persistent message bar', props: { color: '#64C3A0', show_close: false } },
    { label: 'Light + Dark Text', desc: 'Pale bar, dark message', props: { color: '#ecfdf5', show_close: true } },
  ],
  marquee_strip: [
    { label: 'Default Scroll', desc: 'Continuous scrolling text', props: { speed: 'normal', style: 'default' } },
    { label: 'Fast Marquee', desc: 'Quick scrolling highlights', props: { speed: 'fast', style: 'default' } },
    { label: 'Slow Elegant', desc: 'Slow, refined scroll', props: { speed: 'slow', style: 'default' } },
    { label: 'Dark Strip', desc: 'Marquee on dark background', props: { speed: 'normal', style: 'dark' } },
    { label: 'Brand Color', desc: 'Primary color marquee bar', props: { speed: 'normal', style: 'brand' } },
    { label: 'Bold Uppercase', desc: 'All-caps bold text', props: { speed: 'normal', style: 'bold' } },
    { label: 'Dot Separators', desc: 'Items separated by dots', props: { speed: 'normal', separator: 'dot' } },
    { label: 'Pipe Separators', desc: 'Items separated by pipes', props: { speed: 'normal', separator: 'pipe' } },
    { label: 'Compact Slim', desc: 'Thin height marquee', props: { speed: 'normal', compact: true } },
    { label: 'Tight Spacing', desc: 'Closer items in the strip', props: { speed: 'normal', item_gap: 24 } },
    { label: 'Wide Spacing', desc: 'More space between items', props: { speed: 'normal', item_gap: 64 } },
    { label: 'Pause on Hover', desc: 'Stops when user hovers', props: { speed: 'normal', pause_on_hover: true } },
  ],
  rich_text: [
    { label: 'Standard', desc: 'Default text block', props: { layout: 'standard' } },
    { label: 'Narrow Column', desc: 'Readable narrow width', props: { layout: 'narrow', max_width: 'prose' } },
    { label: 'Wide Full', desc: 'Full-width content', props: { layout: 'wide' } },
    { label: 'Centered Prose', desc: 'Centered readable column', props: { layout: 'centered', max_width: 'prose', align: 'center' } },
    { label: 'Two Columns', desc: 'Split into two text columns', props: { layout: 'columns', columns: 2 } },
    { label: 'Card Surface', desc: 'Text inside bordered card', props: { layout: 'card', card_style: 'elevated' } },
    { label: 'Dark Text Block', desc: 'Light text on dark bg', props: { layout: 'standard', bg_style: 'dark' } },
    { label: 'Pull Quote', desc: 'Large featured quote style', props: { layout: 'quote', align: 'center' } },
    { label: 'Minimal Spacing', desc: 'Tight vertical spacing', props: { layout: 'compact', padding_top: 24, padding_bottom: 24 } },
    { label: 'Spacious Article', desc: 'Generous line height + padding', props: { layout: 'spacious', padding_top: 64, padding_bottom: 64 } },
  ],
  timeline: [
    { label: 'Vertical Steps', desc: 'Classic timeline', props: { layout: 'vertical' } },
    { label: 'Horizontal', desc: 'Horizontal milestone row', props: { layout: 'horizontal' } },
    { label: 'Compact List', desc: 'Simple step list', props: { layout: 'list' } },
    { label: 'Numbered Cards', desc: 'Each step in a card', props: { layout: 'vertical', card_style: 'card' } },
    { label: 'Alternating', desc: 'Zigzag left/right steps', props: { layout: 'alternating' } },
    { label: 'Dark Timeline', desc: 'Timeline on dark surface', props: { layout: 'vertical', bg_style: 'dark' } },
    { label: 'Icon Steps', desc: 'Icon markers per step', props: { layout: 'vertical', show_icons: true } },
    { label: 'Compact Horizontal', desc: 'Slim horizontal milestones', props: { layout: 'horizontal', compact: true } },
    { label: 'Progress Bar', desc: 'Connected progress line', props: { layout: 'progress' } },
    { label: 'Minimal Dots', desc: 'Dot markers + labels', props: { layout: 'minimal' } },
  ],
  social_links: [
    { label: 'Icon Row', desc: 'Horizontal social icons', props: { layout: 'row' } },
    { label: 'Icon Grid', desc: 'Grid of social links', props: { layout: 'grid' } },
    { label: 'With Labels', desc: 'Icons + platform names', props: { layout: 'labeled' } },
    { label: 'Circle Buttons', desc: 'Round icon buttons', props: { layout: 'row', button_style: 'circle' } },
    { label: 'Square Buttons', desc: 'Square bordered icons', props: { layout: 'row', button_style: 'square' } },
    { label: 'Dark Row', desc: 'Icons on dark background', props: { layout: 'row', bg_style: 'dark' } },
    { label: 'Brand Colors', desc: 'Full-color platform icons', props: { layout: 'row', colored: true } },
    { label: 'Compact Footer', desc: 'Small footer-style icons', props: { layout: 'row', compact: true } },
    { label: 'Vertical Stack', desc: 'Stacked icon list', props: { layout: 'stack' } },
    { label: 'Card Social', desc: 'Social links in card', props: { layout: 'card' } },
  ],
  divider: [
    { label: 'Simple Line', desc: 'Thin horizontal rule', props: { style: 'line', spacing: 40 } },
    { label: 'Thick Rule', desc: 'Bold divider line', props: { style: 'thick', spacing: 48 } },
    { label: 'Dashed Line', desc: 'Dashed separator', props: { style: 'dashed', spacing: 40 } },
    { label: 'Dotted Line', desc: 'Dotted separator', props: { style: 'dotted', spacing: 40 } },
    { label: 'Gradient Fade', desc: 'Fade-out gradient line', props: { style: 'gradient', spacing: 48 } },
    { label: 'Icon Divider', desc: 'Line with center icon', props: { style: 'icon', spacing: 48 } },
    { label: 'Brand Color', desc: 'Primary color divider', props: { style: 'line', color: '#64C3A0', spacing: 40 } },
    { label: 'Wide Spacing', desc: 'Extra space above/below', props: { style: 'line', spacing: 80 } },
    { label: 'Compact', desc: 'Minimal spacing divider', props: { style: 'line', spacing: 24 } },
    { label: 'Double Line', desc: 'Two parallel lines', props: { style: 'double', spacing: 40 } },
  ],
  spacer: [
    { label: 'Small (40px)', desc: 'Light vertical gap', props: { height: 40 } },
    { label: 'Medium (80px)', desc: 'Standard section gap', props: { height: 80 } },
    { label: 'Large (120px)', desc: 'Generous whitespace', props: { height: 120 } },
    { label: 'XL (160px)', desc: 'Extra large gap', props: { height: 160 } },
    { label: 'XXL (200px)', desc: 'Maximum vertical space', props: { height: 200 } },
    { label: 'Tiny (24px)', desc: 'Minimal spacer', props: { height: 24 } },
    { label: 'Compact (56px)', desc: 'Between small and medium', props: { height: 56 } },
    { label: 'Section (96px)', desc: 'Between-section spacing', props: { height: 96 } },
    { label: 'Hero Gap (140px)', desc: 'Below hero sections', props: { height: 140 } },
    { label: 'Footer Gap (64px)', desc: 'Above footer spacing', props: { height: 64 } },
  ],
  map_embed: [
    { label: 'Full Width Map', desc: 'Edge-to-edge map embed', props: { layout: 'full', height: 400 } },
    { label: 'Card Map', desc: 'Map in rounded card', props: { layout: 'card', height: 350 } },
    { label: 'Split + Info', desc: 'Map beside address info', props: { layout: 'split', height: 400 } },
    { label: 'Compact Map', desc: 'Smaller map height', props: { layout: 'full', height: 280 } },
    { label: 'Tall Map', desc: 'Taller immersive map', props: { layout: 'full', height: 500 } },
    { label: 'Grayscale Map', desc: 'Desaturated map style', props: { layout: 'full', map_style: 'grayscale' } },
    { label: 'Dark Map Frame', desc: 'Map on dark background', props: { layout: 'card', bg_style: 'dark' } },
    { label: 'With Directions', desc: 'Map + get directions CTA', props: { layout: 'split', show_directions: true } },
    { label: 'Minimal Pin', desc: 'Small map with pin only', props: { layout: 'minimal', height: 240 } },
    { label: 'Stacked Info', desc: 'Address above map', props: { layout: 'stacked', height: 360 } },
  ],
  countdown: [
    { label: 'Dark Boxes', desc: 'Countdown on dark background', props: { style: 'boxes', bg_style: 'dark' } },
    { label: 'Light Cards', desc: 'Light card countdown', props: { style: 'cards', bg_style: 'light' } },
    { label: 'Inline Strip', desc: 'Horizontal inline timer', props: { style: 'inline', bg_style: 'gradient' } },
    { label: 'Brand Gradient', desc: 'Gradient countdown banner', props: { style: 'boxes', bg_style: 'gradient' } },
    { label: 'Minimal Text', desc: 'Simple text countdown', props: { style: 'minimal', bg_style: 'light' } },
    { label: 'Circle Units', desc: 'Circular unit badges', props: { style: 'circles', bg_style: 'dark' } },
    { label: 'Split CTA', desc: 'Timer + action button', props: { style: 'split', bg_style: 'dark' } },
    { label: 'Compact Bar', desc: 'Slim countdown strip', props: { style: 'inline', compact: true } },
    { label: 'Flip Clock', desc: 'Flip-style digit animation', props: { style: 'flip', bg_style: 'dark' } },
    { label: 'Card Countdown', desc: 'Timer inside card', props: { style: 'cards', bg_style: 'light', card_style: 'elevated' } },
  ],
  menu_grid: [
    { label: 'Category Tabs', desc: 'Tabbed menu categories', props: { layout: 'tabs', columns: 2 } },
    { label: 'Two Column', desc: 'Classic two-column menu', props: { layout: 'grid', columns: 2 } },
    { label: 'Single Column', desc: 'Full-width menu list', props: { layout: 'list', columns: 1 } },
    { label: 'Card Menu', desc: 'Menu items in cards', props: { layout: 'card', columns: 2 } },
    { label: 'Photo Menu', desc: 'Items with food photos', props: { layout: 'grid', columns: 2, show_images: true } },
    { label: 'Compact List', desc: 'Dense price list', props: { layout: 'list', compact: true } },
    { label: 'Dark Menu', desc: 'Menu on dark background', props: { layout: 'grid', bg_style: 'dark' } },
    { label: 'Featured Dish', desc: 'Hero item + menu list', props: { layout: 'featured', columns: 1 } },
    { label: 'Price Right', desc: 'Name left, price right', props: { layout: 'list', price_align: 'right' } },
    { label: 'Grid 3-Col', desc: 'Three-column menu grid', props: { layout: 'grid', columns: 3 } },
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
    return COMMERCE_VARIANT_PRESETS.map((p, i) => ({
      id: `${blockType}-${i}`,
      label: p.label,
      desc: p.desc,
      props: p.props,
    }))
  }
  return GENERIC_SPACING_PRESETS.map((p, i) => ({
    id: `${blockType}-${i}`,
    label: p.label,
    desc: p.desc,
    props: p.props,
  }))
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

function scoreSectionLayoutOption(
  currentProps: Record<string, unknown>,
  option: SectionLayoutOption,
): number {
  const keys = Object.keys(option.props)
  if (keys.length === 0) return 0
  let score = 0
  for (const key of keys) {
    if (String(currentProps[key] ?? '') === String(option.props[key])) score++
  }
  return score
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
    const score = scoreSectionLayoutOption(currentProps, opt)
    if (score > bestScore) {
      bestScore = score
      best = opt
    }
  }
  if (!best || bestScore < Object.keys(best.props).length) return undefined
  return best
}

/** Closest preset for arrow cycling and panel labels when props only partially match. */
export function findBestSectionLayoutOption(
  currentProps: Record<string, unknown> | undefined,
  options: SectionLayoutOption[],
): SectionLayoutOption | undefined {
  if (!currentProps || options.length === 0) return undefined
  let best: SectionLayoutOption | undefined
  let bestScore = -1
  for (const opt of options) {
    const score = scoreSectionLayoutOption(currentProps, opt)
    if (score > bestScore) {
      bestScore = score
      best = opt
    }
  }
  return bestScore > 0 ? best : undefined
}

export function findActiveLayoutIndex(
  currentProps: Record<string, unknown> | undefined,
  blockType: string,
): number {
  const options = getSectionLayoutOptions(blockType)
  if (!options.length) return 0
  const active =
    findActiveSectionLayoutOption(currentProps, options)
    ?? findBestSectionLayoutOption(currentProps, options)
  if (active) {
    const idx = options.findIndex(o => o.id === active.id)
    if (idx >= 0) return idx
  }
  return 0
}

export function getCycledSectionLayoutOption(
  currentProps: Record<string, unknown> | undefined,
  blockType: string,
  direction: 'prev' | 'next',
): SectionLayoutOption | undefined {
  const options = getSectionLayoutOptions(blockType)
  if (options.length <= 1) return undefined
  const currentIdx = findActiveLayoutIndex(currentProps, blockType)
  const nextIdx = direction === 'next'
    ? (currentIdx + 1) % options.length
    : (currentIdx - 1 + options.length) % options.length
  return options[nextIdx]
}
