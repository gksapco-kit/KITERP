import { v4 as uuid } from 'uuid'
import type { LightboxItem } from '../types/builder'

const SAMPLES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
  'https://images.unsplash.com/photo-1426604966848-d7ad825d0d93?w=1200&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80',
]

export const LIGHTBOX_DEFAULTS = {
  lightboxGridLayout: 'grid' as const,
  lightboxThumbTheme: 'light' as const,
  lightboxOverlay: 'blur' as const,
  showLightboxCaption: true,
  showLightboxCounter: true,
  showLightboxThumbnails: true,
  showLightboxZoomHint: true,
  columns: 3,
}

export function createLightboxItem(overrides: Partial<LightboxItem> = {}): LightboxItem {
  return {
    id: uuid(),
    imageUrl: SAMPLES[0],
    title: '',
    caption: '',
    enabled: true,
    ...overrides,
  }
}

export function defaultLightboxItems(): LightboxItem[] {
  const titles = ['Alpine dawn', 'Forest trail', 'Misty woods', 'Lake reflection', 'Mountain lake', 'Golden hour']
  return SAMPLES.map((url, i) =>
    createLightboxItem({
      imageUrl: url,
      title: titles[i],
      caption: i % 2 === 0 ? 'Click any image to open the fullscreen lightbox viewer' : '',
    }),
  )
}

export function defaultLightboxProps() {
  return {
    text: 'Lightbox Gallery',
    subtitle: 'Click an image to view it fullscreen with navigation',
    lightboxItems: defaultLightboxItems(),
    ...LIGHTBOX_DEFAULTS,
  }
}
