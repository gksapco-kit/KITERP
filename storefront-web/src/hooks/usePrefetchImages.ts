import { useEffect } from 'react'
import { imgUrl } from '@/lib/utils'

const warmed = new Set<string>()

/** Warm the browser cache so variant swaps do not wait on a first download. */
export function prefetchImageUrls(urls: Array<string | null | undefined>) {
  if (typeof window === 'undefined') return
  for (const raw of urls) {
    const src = imgUrl(raw)
    if (!src || warmed.has(src)) continue
    warmed.add(src)
    const img = new Image()
    img.decoding = 'async'
    img.src = src
  }
}

export function usePrefetchImages(urls: Array<string | null | undefined>) {
  const key = urls.filter(Boolean).join('|')
  useEffect(() => {
    prefetchImageUrls(urls)
  }, [key])
}
