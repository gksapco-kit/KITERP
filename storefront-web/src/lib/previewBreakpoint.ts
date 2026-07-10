/** Builder canvas device preview — mirrors DeviceMode / style_overrides breakpoints. */
export type PreviewBreakpoint = 'desktop' | 'tablet' | 'mobile'

/** True when the canvas is simulating a viewport below the Tailwind `lg` (1024px) breakpoint. */
export function previewBelowLg(bp: PreviewBreakpoint | null | undefined): boolean {
  return bp === 'mobile' || bp === 'tablet'
}

/** True when the canvas is simulating a viewport below the Tailwind `md` (768px) breakpoint. */
export function previewBelowMd(bp: PreviewBreakpoint | null | undefined): boolean {
  return bp === 'mobile'
}

/** True when the canvas is simulating a viewport below the Tailwind `sm` (640px) breakpoint. */
export function previewBelowSm(bp: PreviewBreakpoint | null | undefined): boolean {
  return bp === 'mobile'
}

/**
 * Whether a block should render for the active canvas device preview.
 * Live site still uses Tailwind `hidden sm:block` / etc.; the editor must
 * honor visibility flags from `previewBreakpoint` because media queries see
 * the browser window, not the canvas width.
 */
export function isBlockVisibleForPreview(
  block: {
    visible?: boolean
    visible_on_mobile?: boolean
    visible_on_tablet?: boolean
    visible_on_desktop?: boolean
  },
  breakpoint: PreviewBreakpoint,
): boolean {
  if (block.visible === false) return false
  if (breakpoint === 'mobile') return block.visible_on_mobile !== false
  if (breakpoint === 'tablet') return block.visible_on_tablet !== false
  return block.visible_on_desktop !== false
}
