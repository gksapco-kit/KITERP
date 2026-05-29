import { brandImageInlineStyle, normalizeBrandImageFit } from '../../lib/brandImageStyle'
import { resolveBrandImage } from '../../lib/logoItemImage'
import type { LogoItem } from '../../types/builder'

/** Shared footprint — reference logo-slider cards (wide, rounded). */
export const BRAND_CARD_CLASS = 'h-[84px] w-[210px] shrink-0 overflow-hidden rounded-2xl'

interface BrandLogoCardProps {
  item: LogoItem
  grayscale: boolean
  lightText?: boolean
  showBrandTile: boolean
  showBrandName: boolean
}

export function BrandLogoCard({
  item,
  grayscale,
  lightText = false,
  showBrandTile,
  showBrandName,
}: BrandLogoCardProps) {
  const image = resolveBrandImage(item)
  const initial = item.name.trim().charAt(0).toUpperCase() || '?'
  const fit = normalizeBrandImageFit(item.imageFit)
  const grayscaleClass = grayscale
    ? 'opacity-90 grayscale transition duration-300 group-hover/card:grayscale-0'
    : ''

  const tileShell = showBrandTile ? 'bg-white shadow-sm ring-1 ring-black/5' : 'shadow-sm'

  const card = image ? (
    <div className={`group/card relative ${BRAND_CARD_CLASS} ${tileShell}`}>
      {fit === 'contain' ? (
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <img
            src={image}
            alt={item.name || 'Brand'}
            className={`block max-h-full max-w-full object-contain ${grayscaleClass}`}
            style={brandImageInlineStyle(item.imagePosition, item.imageZoom, 'contain')}
          />
        </div>
      ) : (
        <img
          src={image}
          alt={item.name || 'Brand'}
          className={`absolute inset-0 block h-full w-full object-cover ${grayscaleClass}`}
          style={brandImageInlineStyle(item.imagePosition, item.imageZoom, 'cover')}
        />
      )}
    </div>
  ) : (
    <div className={`group/card flex ${BRAND_CARD_CLASS} items-center justify-center ${tileShell}`}>
      <span className="px-3 text-sm font-bold tracking-tight text-gray-600">{item.name || initial}</span>
    </div>
  )

  const showName = showBrandName && !!item.name

  const body = (
    <div className="inline-flex flex-col items-center gap-1.5">
      {card}
      {showName && (
        <p
          className={`max-w-[210px] truncate text-center text-[10px] font-semibold uppercase tracking-wide ${
            lightText ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {item.name}
        </p>
      )}
    </div>
  )

  if (item.link?.trim()) {
    return (
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-block">
        {body}
      </a>
    )
  }

  return body
}
