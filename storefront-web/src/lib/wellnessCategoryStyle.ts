/** Top-down bowl / flat-lay food photography (wellness editorial style). */
const BOWL_TOP = 'https://images.unsplash.com/photo-1546069901-ba9599a881e8?auto=format&fit=crop&w=900&q=80'
const BOWL_BUDDHA = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80'
const BOWL_COLORFUL = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80'
const BOWL_GRAINS = 'https://images.unsplash.com/photo-1498837167922-ddd27525cd3?auto=format&fit=crop&w=900&q=80'
const BOWL_SNACKS = 'https://images.unsplash.com/photo-1606851090756-56d7fd5520ce?auto=format&fit=crop&w=900&q=80'
const BOWL_GROCERY = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80'
const BOWL_DRINK = 'https://images.unsplash.com/photo-1556679343-7190518ceeb4?auto=format&fit=crop&w=900&q=80'
const BOWL_SPREAD = 'https://images.unsplash.com/photo-1464456391031-c8a9c116fe84?auto=format&fit=crop&w=900&q=80'
const BOWL_PICKLE = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80'

/** Healthy-food imagery mapped to common wellness store categories. */
export const WELLNESS_CATEGORY_IMAGE_BY_TITLE: Record<string, string> = {
  'guilt free snacks': BOWL_SNACKS,
  'wholesome snacks': BOWL_SNACKS,
  'gourmet groceries': BOWL_GROCERY,
  'healthy beverages': BOWL_DRINK,
  'meal subscriptions': BOWL_COLORFUL,
  'breakfast cereals': BOWL_GRAINS,
  'nut butters & spreads': BOWL_SPREAD,
  'pickles & powders': BOWL_PICKLE,
  'bars & chikkis': BOWL_SNACKS,
  'seeds & nuts': BOWL_TOP,
  'fruit chews': BOWL_PICKLE,
  'cold pressed oils': BOWL_GRAINS,
  'dried fruits': BOWL_BUDDHA,
  // Restaurant / menu categories (live ERP category strings)
  desserts: 'https://images.unsplash.com/photo-1488477181946-6428a0291776?auto=format&fit=crop&w=900&q=80',
  drinks: BOWL_DRINK,
  beverages: BOWL_DRINK,
  mains: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  starters: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
  appetizers: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
  general: BOWL_GROCERY,
  wine: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80',
  sides: BOWL_TOP,
  breakfast: BOWL_GRAINS,
  lunch: BOWL_COLORFUL,
  dinner: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
  // Fashion editorial defaults
  women: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80',
  men: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=80',
  accessories: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  kids: 'https://images.unsplash.com/photo-1503454537198-1aeabb88b42e?auto=format&fit=crop&w=900&q=80',
}

export const WELLNESS_CATEGORY_FALLBACK_IMAGES = [
  BOWL_BUDDHA,
  BOWL_TOP,
  BOWL_COLORFUL,
  BOWL_GRAINS,
  BOWL_SNACKS,
  BOWL_GROCERY,
  BOWL_DRINK,
  BOWL_SPREAD,
  BOWL_PICKLE,
]

/** Peach canvas behind each card (reference palette). */
export const WELLNESS_CARD_CANVAS_COLORS = [
  '#F8E8E4',
  '#F5E6DC',
  '#FCE8D8',
  '#F5D0C5',
  '#F0E4D4',
  '#E8F0E0',
  '#F8E8E0',
  '#E5F2E8',
  '#FCE4D6',
]

export interface WellnessBlobLayout {
  blobA: { top?: string; left?: string; right?: string; bottom?: string; width: string; height: string }
  blobB: { top?: string; left?: string; right?: string; bottom?: string; width: string; height: string }
  bowlInset: string
}

/** White organic blob layout variants per card index (inline-style safe — no Tailwind scan needed). */
export const WELLNESS_BLOB_LAYOUTS: WellnessBlobLayout[] = [
  { blobA: { top: '4%', left: '6%', width: '78%', height: '72%' }, blobB: { bottom: '6%', right: '4%', width: '58%', height: '52%' }, bowlInset: '16%' },
  { blobA: { top: '8%', right: '5%', width: '72%', height: '68%' }, blobB: { bottom: '4%', left: '8%', width: '62%', height: '56%' }, bowlInset: '18%' },
  { blobA: { top: '6%', left: '10%', width: '70%', height: '74%' }, blobB: { bottom: '8%', right: '10%', width: '55%', height: '48%' }, bowlInset: '15%' },
  { blobA: { top: '10%', left: '4%', width: '76%', height: '66%' }, blobB: { bottom: '5%', right: '8%', width: '60%', height: '54%' }, bowlInset: '17%' },
  { blobA: { top: '5%', right: '8%', width: '74%', height: '70%' }, blobB: { bottom: '10%', left: '5%', width: '56%', height: '50%' }, bowlInset: '16%' },
  { blobA: { top: '7%', left: '8%', width: '68%', height: '72%' }, blobB: { bottom: '6%', right: '6%', width: '64%', height: '52%' }, bowlInset: '18%' },
  { blobA: { top: '4%', right: '6%', width: '80%', height: '68%' }, blobB: { bottom: '8%', left: '6%', width: '52%', height: '48%' }, bowlInset: '15%' },
  { blobA: { top: '9%', left: '5%', width: '75%', height: '65%' }, blobB: { bottom: '4%', right: '5%', width: '58%', height: '56%' }, bowlInset: '17%' },
  { blobA: { top: '6%', left: '12%', width: '72%', height: '76%' }, blobB: { bottom: '7%', right: '12%', width: '54%', height: '46%' }, bowlInset: '16%' },
]

export const WELLNESS_DEFAULT_CATEGORY_TITLES = [
  'Wholesome Snacks',
  'Gourmet Groceries',
  'Healthy Beverages',
  'Breakfast Cereals',
  'Nut Butters & Spreads',
  'Pickles & Powders',
  'Bars & Chikkis',
  'Seeds & Nuts',
  'Fruit Chews',
]

export const WELLNESS_BLOB_COLORS = [
  '#F5D0C5',
  '#FCE8D8',
  '#E8F0E0',
  '#F0E4D4',
  '#F5E6DC',
  '#E5F2E8',
  '#F8E8E0',
  '#E3F0E8',
  '#FCE4D6',
]

export const WELLNESS_BLOB_SHAPES = [
  '48% 52% 55% 45% / 52% 48% 52% 48%',
  '55% 45% 48% 52% / 45% 55% 45% 55%',
  '52% 48% 45% 55% / 48% 52% 48% 52%',
  '45% 55% 52% 48% / 55% 45% 55% 45%',
  '50% 50% 45% 55% / 48% 52% 50% 50%',
  '48% 52% 50% 50% / 52% 48% 52% 48%',
  '60% 40% 55% 45% / 50% 55% 45% 50%',
  '42% 58% 50% 50% / 55% 45% 52% 48%',
  '50% 50% 42% 58% / 48% 52% 55% 45%',
]

/** Wellness mosaic uses a single vibrant-bowl frame (organic blobs + circular crop). */
export type WellnessCardShape = 'vibrant-bowl'

export const WELLNESS_CARD_SHAPES: WellnessCardShape[] = Array(9).fill('vibrant-bowl') as WellnessCardShape[]

export const WELLNESS_FLOAT_CLASSES = [
  'wl-float',
  'wl-float-slow',
  'wl-float',
  'wl-float-slow',
  'wl-float',
  'wl-float-slow',
  'wl-float',
  'wl-float-slow',
  'wl-float',
]

export const WELLNESS_MOTION_CSS = `
@keyframes wl-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes wl-float-slow {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-7px) rotate(1.5deg); }
}
@keyframes wl-pop-in {
  from { opacity: 0; transform: translateY(18px) scale(0.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.wl-float { animation: wl-float 5.5s ease-in-out infinite; }
.wl-float-slow { animation: wl-float-slow 7.5s ease-in-out infinite; }
.wl-pop-in { animation: wl-pop-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.wl-mosaic-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3.5rem 2rem;
  width: 100%;
}
@media (min-width: 640px) {
  .wl-mosaic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4rem 2rem; }
}
@media (min-width: 1024px) {
  .wl-mosaic-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.wl-mosaic-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.wl-mosaic-card:nth-child(even) { transform: translateY(0); }
@media (min-width: 1024px) {
  .wl-mosaic-card:nth-child(even) { transform: translateY(1.75rem); }
}
.wl-mosaic-frame {
  position: relative;
  width: min(78vw, 280px);
  max-width: 300px;
  aspect-ratio: 1 / 1;
  margin-left: auto;
  margin-right: auto;
  flex-shrink: 0;
}
.wl-mosaic-canvas {
  position: absolute;
  inset: 0;
  border-radius: 2.25rem;
  transition: transform 0.5s ease;
}
.group:hover .wl-mosaic-canvas { transform: scale(1.02); }
.wl-mosaic-blob {
  position: absolute;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 30px -12px rgba(0, 0, 0, 0.12);
}
.wl-mosaic-blob-b {
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 6px 24px -10px rgba(0, 0, 0, 0.08);
}
.wl-mosaic-bowl {
  position: absolute;
  z-index: 10;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 18px 45px -15px rgba(39, 72, 50, 0.45);
  outline: 5px solid rgba(255, 255, 255, 0.9);
}
.wl-mosaic-bowl img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  transition: transform 0.7s ease;
}
.group:hover .wl-mosaic-bowl img { transform: scale(1.05); }
.wl-mosaic-bowl-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 3px rgba(61, 61, 61, 0.2);
  pointer-events: none;
  z-index: 11;
}
.wl-mosaic-doodle {
  position: absolute;
  z-index: 20;
  pointer-events: none;
  color: rgba(42, 42, 42, 0.75);
}
.wl-mosaic-label {
  margin-top: 1.5rem;
  text-align: center;
  padding: 0 0.75rem;
  max-width: 280px;
}
.wl-mosaic-cta {
  margin-top: 0.625rem;
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.65;
  transition: opacity 0.2s;
}
.group:hover .wl-mosaic-cta { opacity: 1; }
`

export function resolveCategoryCardImage(
  cat: { title?: string; image_url?: string | null },
  index: number,
  propImageByTitle?: Map<string, string | undefined>,
): string {
  const titleKey = String(cat.title || '').trim().toLowerCase()
  const direct = cat.image_url?.trim()
  if (direct && (direct.startsWith('http') || direct.startsWith('data:') || direct.startsWith('/'))) return direct
  const fromTitle = WELLNESS_CATEGORY_IMAGE_BY_TITLE[titleKey]
  if (fromTitle) return fromTitle
  const fromProps = propImageByTitle?.get(titleKey)?.trim()
  if (fromProps && (fromProps.startsWith('http') || fromProps.startsWith('data:') || fromProps.startsWith('/'))) return fromProps
  return WELLNESS_CATEGORY_FALLBACK_IMAGES[index % WELLNESS_CATEGORY_FALLBACK_IMAGES.length]
}

/** Live/prop category rows → cards with guaranteed image URLs. */
export function normalizeCategoryCardItems(
  items: { title?: string; image_url?: string | null; meta?: Record<string, unknown> }[],
  propImageByTitle?: Map<string, string | undefined>,
): { title: string; image_url: string; appliesTo: string }[] {
  return items.map((c, i) => {
    const title = String(c.title || `Category ${i + 1}`)
    const raw =
      c.image_url?.trim()
      || (typeof c.meta?.image_url === 'string' ? c.meta.image_url.trim() : '')
      || propImageByTitle?.get(title.toLowerCase())?.trim()
      || ''
    return {
      title,
      image_url: resolveCategoryCardImage({ title, image_url: raw || null }, i, propImageByTitle),
      appliesTo: typeof c.meta?.applies_to === 'string' ? c.meta.applies_to : 'both',
    }
  })
}
