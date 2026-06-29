export interface MarqueeItem {
  label: string
  url?: string
  image_url?: string
}

const DEFAULT_MARQUEE_LABELS = [
  'Free shipping',
  'Easy returns',
  'Fresh daily',
  'Handpicked quality',
  'Secure checkout',
  'Local & trusted',
] as const

export function defaultMarqueeItems(): MarqueeItem[] {
  return DEFAULT_MARQUEE_LABELS.map(label => ({ label, url: '', image_url: '' }))
}

function normalizeMarqueeItem(raw: unknown): MarqueeItem | null {
  if (typeof raw === 'string') {
    const label = raw.trim()
    return label ? { label } : null
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    const label = String(rec.label ?? rec.text ?? rec.title ?? '').trim()
    const imageUrl = String(rec.image_url ?? rec.image ?? rec.src ?? '').trim()
    if (!label && !imageUrl) return null
    const url = String(rec.url ?? rec.href ?? '').trim()
    const base: MarqueeItem = { label: label || '' }
    if (url) base.url = url
    if (imageUrl) base.image_url = imageUrl
    return base
  }
  return null
}

/** Resolve marquee rows from `items` (preferred) or legacy comma-separated `text`. */
export function parseMarqueeItems(props: Record<string, unknown>): MarqueeItem[] {
  const rawItems = props.items
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const parsed = rawItems
      .map(normalizeMarqueeItem)
      .filter((item): item is MarqueeItem => item != null)
    if (parsed.length > 0) return parsed
  }

  const text = props.text
  if (typeof text === 'string' && text.trim()) {
    return text
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(label => ({ label }))
  }

  return []
}

export function marqueeItemsToLegacyText(items: MarqueeItem[]): string {
  return items.map(item => item.label).filter(Boolean).join(',')
}
