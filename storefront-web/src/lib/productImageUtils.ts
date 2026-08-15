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
  )
}

/** Image for the selected variant (pack shot), if that variant has its own media. */
export function resolveVariantThumbnailUrl(variant?: VariantLike | null): string | null {
  if (!variant) return null
  const media = variant.media ?? variant.images ?? []
  return pickImageFromList(media)?.url ?? null
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

/** Cart/listing thumbnail for services — prefer media (like vendor list), never video/3D. */
export function resolveServiceThumbnailUrl(input: {
  image_url?: string | null
  media?: ProductImageLike[]
  gallery?: string[]
}): string | null {
  const fromMedia = pickImageFromList(input.media ?? [])
  if (fromMedia?.url) return fromMedia.url

  if (input.image_url) return input.image_url

  const firstGallery = (input.gallery ?? []).find((url) => Boolean(url))
  return firstGallery ?? null
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
