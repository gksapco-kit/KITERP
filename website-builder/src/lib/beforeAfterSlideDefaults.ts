export const BEFORE_AFTER_DEFAULTS = {
  beforeAfterPosition: 50,
  beforeAfterOrientation: 'horizontal' as const,
  beforeAfterAspect: '16/9' as const,
  beforeAfterTheme: 'premium' as const,
  showBeforeAfterLabels: true,
  beforeAfterHandleStyle: 'circle' as const,
  beforeLabel: 'Before',
  afterLabel: 'After',
}

const BEFORE_IMG = 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80'
const AFTER_IMG = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0?w=1200&q=80'

export function defaultBeforeAfterSlideProps() {
  return {
    text: 'See the transformation',
    subtitle: 'Drag the slider to compare before and after',
    beforeImageUrl: BEFORE_IMG,
    afterImageUrl: AFTER_IMG,
    beforeImageAlt: 'Before renovation',
    afterImageAlt: 'After renovation',
    ...BEFORE_AFTER_DEFAULTS,
  }
}

export const BEFORE_AFTER_ASPECT_CLASS = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '3/4': 'aspect-[3/4]',
} as const

export function clampBeforeAfterPosition(value: number): number {
  return Math.min(100, Math.max(0, value))
}
