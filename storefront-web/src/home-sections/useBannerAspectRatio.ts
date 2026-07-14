import { useEffect, useMemo, useState } from 'react'
import { imgUrl } from '@/lib/utils'

/** Soft-clamp extreme uploads so a banner can't dominate or collapse the viewport. */
export function clampBannerAspect(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 3
  return Math.min(6, Math.max(1.15, ratio))
}

/**
 * Measures natural width/height for banner URLs and returns the active image's
 * aspect ratio (width / height) so the hero frame can match each upload.
 */
export function useBannerAspectRatio(urls: string[], activeIndex = 0): number | undefined {
  const urlKey = urls.join('\0')
  const resolved = useMemo(
    () => urls.map((u) => imgUrl(u)).filter(Boolean),
    // urls identity changes often; urlKey is the content dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlKey],
  )
  const [ratios, setRatios] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    for (const src of resolved) {
      const img = new Image()
      img.onload = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return
        const next = clampBannerAspect(img.naturalWidth / img.naturalHeight)
        setRatios((prev) => (prev[src] === next ? prev : { ...prev, [src]: next }))
      }
      img.src = src
    }
    return () => {
      cancelled = true
    }
  }, [resolved])

  if (resolved.length === 0) return undefined
  const idx = Math.min(Math.max(activeIndex, 0), resolved.length - 1)
  return ratios[resolved[idx]]
}
