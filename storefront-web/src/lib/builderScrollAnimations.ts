export type BlockScrollAnimationId =
  | 'none'
  | 'fade-in'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'flip'
  | 'bounce-in'
  | 'blur-in'
  | 'rotate-in'
  | 'pop-in'
  | 'reveal-up'

export type BlockScrollAnimationOption = {
  id: BlockScrollAnimationId
  label: string
  /** Short glyph for compact toolbar grid */
  glyph: string
  title: string
  className: string | null
}

export const BLOCK_SCROLL_ANIMATIONS: BlockScrollAnimationOption[] = [
  { id: 'none', label: 'None', glyph: '⊘', title: 'No animation', className: null },
  { id: 'fade-in', label: 'Fade', glyph: '✨', title: 'Fade in', className: 'animate-fade-in' },
  { id: 'slide-up', label: 'Slide up', glyph: '⬆', title: 'Slide up from below', className: 'animate-slide-up' },
  { id: 'slide-down', label: 'Slide down', glyph: '⬇', title: 'Slide down from above', className: 'animate-slide-down' },
  { id: 'slide-left', label: 'From left', glyph: '◀', title: 'Slide in from the left', className: 'animate-slide-left' },
  { id: 'slide-right', label: 'From right', glyph: '▶', title: 'Slide in from the right', className: 'animate-slide-right' },
  { id: 'zoom-in', label: 'Zoom in', glyph: '🔍', title: 'Zoom in', className: 'animate-zoom-in' },
  { id: 'zoom-out', label: 'Zoom out', glyph: '🔎', title: 'Zoom out from larger', className: 'animate-zoom-out' },
  { id: 'flip', label: 'Flip', glyph: '🔄', title: 'Flip in on X axis', className: 'animate-flip-in' },
  { id: 'bounce-in', label: 'Bounce', glyph: '🎾', title: 'Bounce up into place', className: 'animate-bounce-in' },
  { id: 'blur-in', label: 'Blur', glyph: '🌫', title: 'Blur to sharp', className: 'animate-blur-in' },
  { id: 'rotate-in', label: 'Rotate', glyph: '↻', title: 'Rotate and settle', className: 'animate-rotate-in' },
  { id: 'pop-in', label: 'Pop', glyph: '💥', title: 'Pop with slight overshoot', className: 'animate-pop-in' },
  { id: 'reveal-up', label: 'Reveal', glyph: '▴', title: 'Reveal upward with clip', className: 'animate-reveal-up' },
]

export const ANIMATION_DELAY_PRESETS_MS = [0, 100, 200, 300, 500, 750, 1000, 1500, 2000] as const

export const ANIMATION_DELAY_MAX_MS = 3000

export function getBlockScrollAnimationClass(animation: string | null | undefined): string {
  if (!animation || animation === 'none') return ''
  const match = BLOCK_SCROLL_ANIMATIONS.find(row => row.id === animation)
  return match?.className ?? ''
}

export function formatAnimationDelay(ms: number): string {
  if (ms >= 1000 && ms % 1000 === 0) return `${ms / 1000}s`
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function animationOptionLabel(id: string | null | undefined): string {
  if (!id || id === 'none') return 'None'
  return BLOCK_SCROLL_ANIMATIONS.find(row => row.id === id)?.label ?? id.replace(/-/g, ' ')
}
