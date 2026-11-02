import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { formatCurrency, imgUrl } from '@/lib/utils'

/** Boutique grid card — image, optional discount badge, price + strikethrough, italic title. */
export function SilkAtelierCatalogProductCard({
  name,
  slug,
  imageUrl,
  price,
  compareAtPrice,
  linkTo,
  primary,
  accent,
  headingFont,
  brandLabel,
}: {
  name: string
  slug: string
  imageUrl?: string | null
  price: number | null
  compareAtPrice?: number | null
  linkTo: string
  primary: string
  accent: string
  headingFont?: string
  brandLabel?: string
}) {
  const serif = headingFont ? `"${headingFont}", Georgia, serif` : 'Georgia, serif'
  const showCompare = price != null && compareAtPrice != null && compareAtPrice > price
  const discountPct = showCompare ? Math.round((1 - price! / compareAtPrice!) * 100) : 0

  return (
    <Link
      to={linkTo}
      className="group block cursor-pointer no-underline hover:no-underline"
      data-product-slug={slug}
    >
      <div className="relative overflow-hidden rounded-md border border-black/10 bg-white shadow-sm transition-shadow group-hover:shadow-md">
        {imageUrl ? (
          <img
            src={imgUrl(imageUrl)}
            alt={name}
            className="aspect-[3/4] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100">
            <ShoppingBag className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {showCompare && discountPct > 0 ? (
          <span
            className="absolute left-2 top-2 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1a1a1a]"
            style={{ background: accent }}
          >
            {discountPct}% OFF
          </span>
        ) : null}
        {brandLabel ? (
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-700">
            {brandLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-3 px-0.5">
        {price != null ? (
          <p className="text-[15px] leading-snug" style={{ fontFamily: serif, color: primary }}>
            <span className="font-semibold not-italic">{formatCurrency(price)}</span>
            {showCompare ? (
              <span className="ml-2 text-sm font-normal line-through opacity-70" style={{ color: '#c45c8a' }}>
                {formatCurrency(compareAtPrice!)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="min-h-[1.25rem]" aria-hidden />
        )}
        <h3
          className="mt-1.5 line-clamp-2 text-[15px] font-normal italic leading-snug"
          style={{ color: primary, fontFamily: serif }}
        >
          {name}
        </h3>
      </div>
    </Link>
  )
}
