import { useState } from 'react'
import { galleryPickerImageSrc, type BusinessImage } from '@/data/businessImagePack'

type Props = {
  image: BusinessImage
  className?: string
  /** Called when both primary and fallback URLs fail to load. */
  onFailed?: () => void
}

/** Gallery thumbnail with local→stock fallback; renders nothing when the image cannot load. */
export function BusinessGalleryThumb({ image, className, onFailed }: Props) {
  const [src, setSrc] = useState(() => galleryPickerImageSrc(image))
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <img
      src={src}
      alt={image.label}
      loading="lazy"
      onError={() => {
        if (image.fallbackUrl && src !== image.fallbackUrl) {
          setSrc(image.fallbackUrl)
          return
        }
        setHidden(true)
        onFailed?.()
      }}
      className={className}
    />
  )
}
