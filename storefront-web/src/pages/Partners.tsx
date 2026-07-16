import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock3, Globe, Heart, MapPin, Search, Users } from 'lucide-react'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingChatbot } from '@/components/landing/LandingChatbot'
import { vendorInitials } from '@/components/landing/landingData'
import {
  formatPartnerLocation,
  formatPartnerTimings,
  partnerDisplayName,
  partnerMapsHref,
  partnerSiteHref,
  partnerWhatsAppHref,
  type PartnerVendor,
} from '@/lib/partnerDirectory'
import { mediaUrl } from '@/lib/utils'
import '@/styles/kiterp-landing.css'

const FAV_KEY = 'kiterp_partner_favorites'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function writeFavorites(set: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]))
}

const actionBtn =
  'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64C3A0]/40'

export default function Partners() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<PartnerVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiClient
      .get<{ items: PartnerVendor[] }>('/catalog/vendors', { params: { limit: 100 } })
      .then((res) => {
        if (!cancelled) setVendors(res.data.items || [])
      })
      .catch(() => {
        if (!cancelled) {
          setVendors([])
          setError('Could not load partners. Is the API running?')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return vendors
    return vendors.filter((v) => {
      const hay = [
        v.display_name,
        v.business_name,
        v.slug,
        v.city,
        v.state,
        v.street_address,
        v.store_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [vendors, query])

  const toggleFavorite = (slug: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      writeFavorites(next)
      return next
    })
  }

  return (
    <div className="kiterp-landing font-kiterp-body min-h-screen bg-[linear-gradient(180deg,#f3faf7_0%,#f7f8f8_42%,#f4f5f5_100%)]">
      <LandingHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-[#64C3A0]/15 bg-white/80 backdrop-blur-sm px-5 py-7 sm:px-8 sm:py-9 mb-8 sm:mb-10 shadow-[0_8px_30px_rgba(30,61,52,0.04)]">
          <div
            className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[#64C3A0]/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#ffc954]/20 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-xl">
              <p className="inline-flex items-center rounded-full bg-[#eef9f4] px-3 py-1 text-xs font-semibold tracking-wide text-[#3d9a7a] uppercase">
                Community
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#1e3d34]">
                Our Partners
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#1e3d34]/65 leading-relaxed">
                Discover published businesses on KIT ERP — locations, WhatsApp, and live storefronts.
              </p>
              {!loading && !error && (
                <p className="mt-4 text-sm font-medium text-[#3d9a7a]">
                  {filtered.length} partner{filtered.length === 1 ? '' : 's'}
                  {query.trim() ? ' match your search' : ' on the directory'}
                </p>
              )}
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1e3d34]/40" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search partners…"
                className="w-full rounded-2xl border border-[#1e3d34]/10 bg-white pl-10 pr-4 py-3 text-sm text-[#1e3d34] placeholder:text-[#1e3d34]/40 outline-none shadow-sm focus:border-[#64C3A0] focus:ring-4 focus:ring-[#64C3A0]/15 transition"
              />
            </div>
          </div>
        </section>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[210px] rounded-3xl bg-white/80 border border-[#1e3d34]/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl bg-white border border-red-100 px-6 py-12 text-center shadow-sm">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#64C3A0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#52b38f] transition"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-3xl bg-white border border-[#1e3d34]/6 px-6 py-14 text-center shadow-sm">
            <p className="text-[#1e3d34]/55 text-sm">No published partners found.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filtered.map((v) => {
              const name = partnerDisplayName(v)
              const location = formatPartnerLocation(v)
              const timings = formatPartnerTimings(v.business_hours)
              const whatsapp = partnerWhatsAppHref(v)
              const site = partnerSiteHref(v)
              const maps = partnerMapsHref(v)
              const fav = favorites.has(v.slug)
              const visits = v.visit_count ?? 0
              const showStoreName =
                Boolean(v.store_name) &&
                v.store_name!.trim().toLowerCase() !== name.trim().toLowerCase()

              return (
                <article
                  key={v.slug}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/partners/${v.slug}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/partners/${v.slug}`)
                    }
                  }}
                  className="group relative flex flex-col rounded-3xl border border-[#1e3d34]/8 bg-white p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-[#64C3A0]/35 hover:shadow-[0_18px_40px_rgba(30,61,52,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64C3A0]/45"
                >
                  <div className="flex gap-4">
                    <div className="relative shrink-0">
                      <div className="w-[76px] h-[76px] rounded-2xl overflow-hidden bg-[linear-gradient(145deg,#eef9f4,#f7f8f8)] ring-1 ring-[#1e3d34]/8 flex items-center justify-center shadow-sm">
                        {v.logo_url ? (
                          <img
                            src={mediaUrl(v.logo_url)}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-base font-bold text-[#3d9a7a]">
                            {vendorInitials(name)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-bold text-[16px] text-[#1e3d34] leading-snug line-clamp-2">
                          {name}
                        </h2>
                        <span className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#64C3A0]">
                          <ArrowUpRight className="w-4 h-4" />
                        </span>
                      </div>

                      {showStoreName && (
                        <p className="mt-1 text-xs font-medium text-[#3d9a7a] truncate">
                          {v.store_name}
                        </p>
                      )}

                      {location ? (
                        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-[#1e3d34]/55 leading-snug">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#EA4335]/80" />
                          <span className="line-clamp-2">{location}</span>
                        </p>
                      ) : (
                        <p className="mt-2 text-[13px] text-[#1e3d34]/35">Location not listed</p>
                      )}

                      {timings && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#1e3d34]/45">
                          <Clock3 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{timings.replace(/^Timings:\s*/i, '')}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-5 flex items-center justify-between gap-3 border-t border-[#1e3d34]/06">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E8] px-2.5 py-1 text-[11px] font-semibold text-[#C47F0A]">
                      <Users className="w-3.5 h-3.5" />
                      {visits.toLocaleString()} visits
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={fav ? 'Remove favorite' : 'Save favorite'}
                        onClick={(e) => toggleFavorite(v.slug, e)}
                        className={`${actionBtn} border border-[#1e3d34]/10 bg-white text-[#1e3d34]/45 hover:text-rose-500 hover:border-rose-200`}
                      >
                        <Heart className={`w-4 h-4 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp"
                          className={`${actionBtn} bg-[#25D366] text-white hover:brightness-95 shadow-sm shadow-[#25D366]/25`}
                        >
                          <WhatsAppIcon className="w-4 h-4" />
                        </a>
                      )}
                      {site.external ? (
                        <a
                          href={site.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Website"
                          className={`${actionBtn} bg-[#1e3d34] text-white hover:bg-[#2a5246]`}
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      ) : (
                        <Link
                          to={site.href}
                          aria-label="Open storefront"
                          className={`${actionBtn} bg-[#1e3d34] text-white hover:bg-[#2a5246]`}
                        >
                          <Globe className="w-4 h-4" />
                        </Link>
                      )}
                      {maps && (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Location on map"
                          className={`${actionBtn} border border-[#1e3d34]/10 bg-white hover:bg-[#eef9f4]`}
                        >
                          <MapPin className="w-4 h-4 text-[#EA4335]" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-[#1e3d34]/50">
          Looking for a full storefront?{' '}
          <Link to="/" className="text-[#3d9a7a] font-semibold hover:text-[#64C3A0] transition-colors">
            Back to home
          </Link>
        </p>
      </main>
      <LandingFooter />
      <LandingChatbot />
    </div>
  )
}
