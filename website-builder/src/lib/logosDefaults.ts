import { v4 as uuid } from 'uuid'
import type { LogoItem } from '../types/builder'

export function createDefaultLogo(overrides: Partial<LogoItem> = {}): LogoItem {
  return {
    id: uuid(),
    name: 'Brand',
    imageUrl: '',
    imageFit: 'contain',
    imagePosition: 'center',
    imageZoom: 100,
    link: '',
    showTitle: false,
    backgroundImage: '',
    ...overrides,
  }
}

export function defaultLogoItems(): LogoItem[] {
  return [
    createDefaultLogo({ name: 'Acme Corp' }),
    createDefaultLogo({ name: 'Globex' }),
    createDefaultLogo({ name: 'Initech' }),
    createDefaultLogo({ name: 'Umbrella' }),
    createDefaultLogo({ name: 'Stark Industries' }),
    createDefaultLogo({ name: 'Wayne Enterprises' }),
  ]
}

export const LOGOS_DISPLAY_DEFAULTS = {
  logosGrayscale: false,
  logosLayout: 'manualSlider' as const,
  columns: 4,
  logosShowBrandTile: true,
  logosShowBrandNames: false,
}

export function defaultLogosBlockProps() {
  return {
    text: 'Logo Carousel',
    subtitle: '',
    ...LOGOS_DISPLAY_DEFAULTS,
    logoItems: defaultLogoItems(),
  }
}

export function resolveLogoItems(props: { logoItems?: LogoItem[]; logos?: string[] }): LogoItem[] {
  if (props.logoItems?.length) return props.logoItems
  if (props.logos?.length) {
    return props.logos.map((name) => ({ id: uuid(), name, imageUrl: '', link: '' }))
  }
  return []
}
