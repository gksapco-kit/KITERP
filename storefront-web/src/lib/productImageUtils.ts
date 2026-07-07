type ProductImageLike = {
  url: string
  is_primary?: boolean
  media_type?: string
  alt_text?: string
}

type VariantMediaLike = {
  url: string
  is_primary?: boolean
  media_type?: string
  alt_text?: string
}

type VariantLike = {
  media?: VariantMediaLike[]
  images?: VariantMediaLike[]
}

function isImageMedia(item?: { media_type?: string }): boolean {
  return !item?.media_type || item.media_type === 'image'
}

function pickImageFromList(items: ProductImageLike[]): ProductImageLike | undefined {
  return (
    items.find((i) => i.url && isImageMedia(i) && i.is_primary)
    ?? items.find((i) => i.url && isImageMedia(i))
    ?? items.find((i) => i.url)
  )
}

/** Primary thumbnail: product images first, then variant media (matches vendor panel). */
export function resolveProductThumbnailUrl(input: {
  images?: ProductImageLike[]
  variants?: VariantLike[]
}): string | null {
  const productImg = pickImageFromList(input.images ?? [])
  if (productImg?.url) return productImg.url

  for (const variant of input.variants ?? []) {
    const media = variant.media ?? variant.images ?? []
    const variantImg = pickImageFromList(media)
    if (variantImg?.url) return variantImg.url
  }

  return null
}

/** Gallery for cards: product images plus variant media, deduped by URL. */
export function collectProductGalleryImages(input: {
  images?: ProductImageLike[]
  variants?: VariantLike[]
}): ProductImageLike[] {
  const seen = new Set<string>()
  const out: ProductImageLike[] = []

  const add = (img: ProductImageLike) => {
    if (!img.url || seen.has(img.url)) return
    seen.add(img.url)
    out.push(img)
  }

  for (const img of input.images ?? []) {
    if (isImageMedia(img)) add(img)
  }
  for (const variant of input.variants ?? []) {
    for (const item of variant.media ?? variant.images ?? []) {
      if (item.url && isImageMedia(item)) add(item)
    }
  }

  return out
}
