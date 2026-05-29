export type SectionDisplayLayout =
  | 'grid'
  | 'row'
  | 'featured'
  | 'featuredAuto'
  | 'manualSlider'
  | 'autoSlider'
  | 'carousel'

export const DEFAULT_SLIDER_INTERVAL_SECONDS = 4

export type TestimonialLayout = 'featured' | 'manualSlider'

export function normalizeTestimonialLayout(layout?: string): TestimonialLayout {
  if (layout === 'featured' || layout === 'featuredAuto') return 'featured'
  return 'manualSlider'
}

export function resolveTestimonialAutoSlide(props: {
  testimonialAutoSlide?: boolean
  testimonialLayout?: string
}): boolean {
  if (typeof props.testimonialAutoSlide === 'boolean') return props.testimonialAutoSlide
  const l = props.testimonialLayout
  return l === 'featuredAuto' || l === 'autoSlider'
}

export function testimonialSliderMode(autoSlide: boolean): 'manual' | 'auto' {
  return autoSlide ? 'auto' : 'manual'
}

export function isFeaturedTestimonialLayout(layout: TestimonialLayout): boolean {
  return layout === 'featured'
}

export function normalizeTeamLayout(layout?: string): SectionDisplayLayout {
  if (layout === 'grid' || layout === 'manualSlider' || layout === 'autoSlider') return layout
  return 'grid'
}

export function normalizeLogosLayout(layout?: string): 'manualSlider' | 'autoSlider' {
  if (layout === 'autoSlider') return 'autoSlider'
  // Legacy grid / row → carousel
  return 'manualSlider'
}

export function isSliderLayout(layout: SectionDisplayLayout): boolean {
  return layout === 'manualSlider' || layout === 'autoSlider'
}

export function sliderModeFromLayout(layout: SectionDisplayLayout): 'manual' | 'auto' | null {
  if (layout === 'manualSlider') return 'manual'
  if (layout === 'autoSlider') return 'auto'
  return null
}

export function clampIntervalSeconds(seconds?: number): number {
  const n = Number(seconds)
  if (!Number.isFinite(n)) return DEFAULT_SLIDER_INTERVAL_SECONDS
  return Math.min(30, Math.max(2, Math.round(n)))
}

/** Split items into pages for slider (e.g. 3 logos per slide). */
export function chunkIntoSlides<T>(items: T[], perSlide: number): T[][] {
  const size = Math.max(1, perSlide)
  if (items.length === 0) return []
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size))
  }
  return pages
}
