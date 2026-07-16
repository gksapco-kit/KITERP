import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Globe, MapPin, Users } from 'lucide-react'
import { apiClient, setVendorContext } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingChatbot } from '@/components/landing/LandingChatbot'
import { vendorInitials } from '@/components/landing/landingData'
import {
  cleanLocationPart,
  formatPartnerLocation,
  formatPartnerTimings,
  partnerDisplayName,
  partnerMapsHref,
  partnerWebsiteHref,
  partnerWhatsAppHref,
  type PartnerVendor,
} from '@/lib/partnerDirectory'
import type { Product, PaginatedResponse } from '@/types'
import { resolveProductThumbnailUrl } from '@/lib/productImageUtils'
import { mediaUrl } from '@/lib/utils'
import '@/styles/kiterp-landing.css'

type PartnerProfile = PartnerVendor & {
  id: string
  description?: string | null
  banner_url?: string | null
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function productImageSrc(p: Product): string | null {
  const raw = resolveProductThumbnailUrl({ images: p.images, variants: p.variants })
  if (!raw) return null
  return mediaUrl(raw) || raw
}

function ProductOfferThumb({
  name,
  src,
}: {
  name: string
  src: string | null
}) {
  const [broken, setBroken] = useState(false)
  const showImg = Boolean(src) && !broken

  return (
    <>
      {showImg && (
        <img
          src={src!}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
      {!showImg && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm px-2 text-center">
          {name}
        </div>
      )}
    </>
  )
}

export default function PartnerDetail() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [vendor, setVendor] = useState<PartnerProfile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visitCount, setVisitCount] = useState(0)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const profileRes = await apiClient.get<PartnerProfile>(`/catalog/vendor/${slug}`)
        if (cancelled) return
        const profile = profileRes.data
        setVendor(profile)
        setVisitCount(profile.visit_count ?? 0)
        setVendorContext(profile.slug, profile.id)

        // Record visit (best-effort; don't block UI)
        apiClient
          .post<{ visit_count: number }>(`/catalog/vendor/${slug}/visit`)
          .then((r) => {
            if (!cancelled) setVisitCount(r.data.visit_count)
          })
          .catch(() => {})

        const productsRes = await apiClient.get<PaginatedResponse<Product>>(
          '/catalog/products',
          { params: { page: 1, size: 24 } },
        )
        if (cancelled) return
        setProducts(productsRes.data.items || [])
      } catch {
        if (!cancelled) {
          setVendor(null)
          setProducts([])
          setError('Partner not found or unavailable.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const name = vendor ? partnerDisplayName(vendor) : ''
  const location = vendor ? formatPartnerLocation(vendor) : ''
  const timings = vendor ? formatPartnerTimings(vendor.business_hours) : null
  const whatsapp = vendor ? partnerWhatsAppHref(vendor) : null
  const website = vendor ? partnerWebsiteHref(vendor) : null
  const maps = vendor ? partnerMapsHref(vendor) : null

  const showStoreName =
    Boolean(vendor?.store_name) &&
    vendor!.store_name!.trim().toLowerCase() !== name.trim().toLowerCase()

  return (
    <div className="kiterp-landing font-kiterp-body min-h-screen bg-[linear-gradient(180deg,#f3faf7_0%,#f7f8f8_42%,#f4f5f5_100%)]">
      <LandingHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <Link
          to="/partners"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1e3d34]/60 hover:text-[#64C3A0] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Our Partners
        </Link>

        {loading && (
          <div className="space-y-6">
            <div className="h-44 rounded-3xl bg-white/80 border border-[#1e3d34]/5 animate-pulse" />
            <div className="h-72 rounded-3xl bg-white/80 border border-[#1e3d34]/5 animate-pulse" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl bg-white border border-red-100 text-red-600 px-5 py-10 text-center text-sm shadow-sm">
            {error}
          </div>
        )}

        {!loading && vendor && (
          <>
            <section className="relative overflow-hidden bg-white rounded-3xl border border-[#1e3d34]/8 p-5 sm:p-7 mb-6 shadow-[0_8px_30px_rgba(30,61,52,0.04)]">
              <div
                className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-[#64C3A0]/12 blur-3xl"
                aria-hidden
              />
              <div className="relative flex flex-col sm:flex-row gap-5 sm:gap-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[linear-gradient(145deg,#eef9f4,#f7f8f8)] ring-1 ring-[#1e3d34]/8 shrink-0 flex items-center justify-center shadow-sm">
                  {vendor.logo_url ? (
                    <img
                      src={mediaUrl(vendor.logo_url)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold text-[#3d9a7a]">{vendorInitials(name)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1e3d34]">{name}</h1>
                  {showStoreName && (
                    <p className="mt-1 text-sm font-medium text-[#3d9a7a]">{vendor.store_name}</p>
                  )}
                  {location ? (
                    <div className="mt-3 flex items-start gap-2 text-sm text-[#1e3d34]/65">
                      <MapPin className="w-4 h-4 text-[#EA4335] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="leading-relaxed">{location}</p>
                        {vendor.country && cleanLocationPart(vendor.country) && (
                          <p className="text-[#1e3d34]/45">{cleanLocationPart(vendor.country)}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[#1e3d34]/35">Location not listed</p>
                  )}
                  {timings && <p className="mt-2 text-sm text-[#1e3d34]/50">{timings}</p>}
                  {vendor.description && (
                    <p className="mt-3 text-sm text-[#1e3d34]/65 leading-relaxed line-clamp-3">
                      {vendor.description}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E8] px-3 py-1.5 text-xs font-semibold text-[#C47F0A]">
                      <Users className="w-3.5 h-3.5" />
                      {visitCount.toLocaleString()} visits
                    </span>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-1.5 text-xs font-semibold text-white hover:brightness-95 shadow-sm shadow-[#25D366]/25"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    )}
                    {website && (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e3d34] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2a5246]"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Website
                      </a>
                    )}
                    {maps && (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#1e3d34]/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1e3d34]/75 hover:bg-[#eef9f4]"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#EA4335]" />
                        Map
                      </a>
                    )}
                    <Link
                      to={`/store/${vendor.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#64C3A0] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#52b38f]"
                    >
                      Open storefront
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-[#1e3d34]/8 p-5 sm:p-7 shadow-[0_8px_30px_rgba(30,61,52,0.04)]">
              <h2 className="text-xl font-bold tracking-tight text-[#1e3d34] mb-5">Products/Offers</h2>
              {products.length === 0 ? (
                <p className="text-sm text-[#1e3d34]/45 py-10 text-center">
                  No products listed yet for this partner.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {products.map((p) => {
                    const img = productImageSrc(p)
                    const views = p.view_count ?? 0
                    const waHref = whatsapp
                      ? `${whatsapp}${whatsapp.includes('?') ? '&' : '?'}text=${encodeURIComponent(`Hi, I'm interested in ${p.name}`)}`
                      : null

                    return (
                      <div key={p.id} className="min-w-0 group/card">
                        <Link
                          to={`/store/${vendor.slug}/products/${p.slug}`}
                          className="block relative rounded-2xl overflow-hidden bg-[#1a3d2e] aspect-[4/3] ring-1 ring-[#1e3d34]/10 transition group-hover/card:ring-[#64C3A0]/35"
                        >
                          <ProductOfferThumb name={p.name} src={img} />
                          <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur px-2.5 py-0.5 text-[11px] font-semibold text-[#1e3d34] shadow-sm">
                            <Eye className="w-3 h-3" aria-hidden />
                            {views.toLocaleString()}
                          </span>
                        </Link>
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2.5 flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white hover:brightness-95 shadow-sm shadow-[#25D366]/20"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                            WhatsApp
                          </a>
                        ) : (
                          <Link
                            to={`/store/${vendor.slug}/products/${p.slug}`}
                            className="mt-2.5 flex items-center justify-center w-full rounded-xl bg-[#1e3d34] py-2.5 text-sm font-semibold text-white hover:bg-[#2a5246]"
                          >
                            View product
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <LandingFooter />
      <LandingChatbot />
    </div>
  )
}
