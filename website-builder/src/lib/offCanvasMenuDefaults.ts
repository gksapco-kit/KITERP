import { v4 as uuid } from 'uuid'
import type { OffCanvasLinkItem } from '../types/builder'

export const OFF_CANVAS_MENU_DEFAULTS = {
  offCanvasSide: 'left' as const,
  offCanvasTheme: 'light' as const,
  offCanvasPreviewOpen: true,
  buttonText: 'Menu',
}

export function createOffCanvasLink(overrides: Partial<OffCanvasLinkItem> = {}): OffCanvasLinkItem {
  return { id: uuid(), label: 'Link', link: '#', enabled: true, ...overrides }
}

export function defaultOffCanvasLinks(): OffCanvasLinkItem[] {
  return [
    createOffCanvasLink({ label: 'Home', link: '/' }),
    createOffCanvasLink({ label: 'Shop', link: '#products' }),
    createOffCanvasLink({ label: 'About', link: '#about' }),
    createOffCanvasLink({ label: 'Contact', link: '#contact' }),
  ]
}

export function defaultOffCanvasMenuProps() {
  return {
    text: 'Navigation',
    offCanvasLinks: defaultOffCanvasLinks(),
    ...OFF_CANVAS_MENU_DEFAULTS,
  }
}

export const OFF_CANVAS_SIDE_CLASS = {
  left: 'left-0',
  right: 'right-0',
} as const
