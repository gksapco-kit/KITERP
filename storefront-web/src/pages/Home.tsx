import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useProducts, useServices } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { useBranch } from '@/contexts/BranchContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, imgUrl } from '@/lib/utils'
import { linkOnLight, textOnSolid } from '@/lib/themeColors'
import {
  ArrowRight, ShoppingBag, Wrench, Loader2, Star, Truck, ShieldCheck,
  RefreshCw, Headphones, Clock, ChevronRight, Quote, MapPin, Phone,
  Mail, Briefcase, Users, ExternalLink, Send, Navigation,
} from 'lucide-react'
import StarRating from '@/components/StarRating'
import { storeApi, type StoreLocation } from '@/api/store'
import type { SectionProps } from '@/home-sections/types'
import {
  HeroSection,
  str,
  editorialKitFromTemplate,
  radiusClass,
} from '@/home-sections'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface HomeSection { id: string; visible: boolean; props: SectionProps }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SECTION COMPONENTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TrustBadgesSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const badges = [
    { icon: Truck, text: str(props.badge_1, 'Free Shipping') },
    { icon: ShieldCheck, text: str(props.badge_2, 'Secure Payment') },
    { icon: RefreshCw, text: str(props.badge_3, 'Easy Returns') },
    { icon: Headphones, text: str(props.badge_4, '24/7 Support') },
  ]
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-5">
          {badges.map((b) => (
            <div key={b.text} className="flex items-center gap-2.5 justify-center rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-3 text-base text-gray-700">
              <b.icon className="w-5 h-5 shrink-0" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
              <span className="font-semibold">{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OffersBannerSection({ props, colors, storePath }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; storePath: (p: string) => string }) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <div className="rounded-xl p-5 text-center" style={{ background: `linear-gradient(135deg, ${colors.accent}15, ${colors.primary}15)`, border: `1px dashed ${colors.accent}` }}>
        <p className="text-lg font-bold" style={{ color: colors.accent }}>{str(props.headline, 'Special Offers')}</p>
        <p className="text-sm text-gray-600 mt-1">{str(props.subtitle, 'Check out our latest deals and discounts')}</p>
        <Link to={storePath('/products')}>
          <Button size="sm" className="mt-3" style={{ backgroundColor: colors.accent, color: textOnSolid(colors.accent) }}>View Offers <ArrowRight className="w-4 h-4 ml-1" /></Button>
        </Link>
      </div>
    </div>
  )
}

function FeaturedProductsSection({ props, theme, storePath, products, isLoading, templateId }: {
  props: SectionProps
  theme: ReturnType<typeof useTheme>
  storePath: (p: string) => string
  products: any
  isLoading: boolean
  templateId?: string
}) {
  const c = theme.colors
  const layout = str(props.layout, theme.product_layout || 'grid-4')
  const gridClass = layout === 'grid-3' ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3' : layout === 'grid-2' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'

  if (editorialKitFromTemplate(templateId) === 'atelier') {
    const viewAll = str(props.view_all_link as string, '') ? storePath(str(props.view_all_link as string, '/products')) : storePath('/products')
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 bg-retail-bg text-retail-ink">
        <div className="flex items-end justify-between mb-10">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight">{str(props.title, 'Featured.')}</h2>
          <Link to={viewAll} className="text-sm border-b border-retail-ink/30 pb-1">See all â†’</Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-retail-accent" /></div>
        ) : !products?.items?.length ? (
          <p className="text-center text-sm opacity-60">No products yet</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.items.map((p: any) => (
              <Link key={p.id} to={storePath(`/products/${p.slug}`)} className="group">
                <div className="aspect-[3/4] bg-secondary rounded-2xl mb-4 overflow-hidden relative">
                  {p.images?.[0] ? (
                    <img src={imgUrl(p.images[0].url)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-secondary to-muted group-hover:scale-105 transition-transform duration-700" />
                  )}
                  {p.compare_at_price && p.compare_at_price > p.price && (
                    <span className="absolute top-3 left-3 text-xs uppercase tracking-widest bg-retail-ink text-retail-bg px-2 py-1 rounded-full">Sale</span>
                  )}
                </div>
                <div className="flex justify-between text-sm gap-2">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="opacity-70 shrink-0">{formatCurrency(p.price > 0 ? p.price : (p.variants?.[0]?.price ?? 0))}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.title, 'Featured Products')}</h2>
          <p className="text-sm text-gray-600 mt-0.5">Discover our top picks for you</p>
        </div>
        <Link to={storePath('/products')} className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: linkOnLight(c.primary, c.secondary) }}>
          See all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : !products?.items?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No products available yet</p>
        </div>
      ) : (
        <div className={`grid gap-4 sm:gap-6 ${gridClass}`}>
          {products.items.map((p: any) => (
            <Link key={p.id} to={storePath(`/products/${p.slug}`)}
              className="group bg-white rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 overflow-hidden shadow-sm">
              <div className="aspect-square bg-gray-50 overflow-hidden relative">
                {p.images?.[0] ? (
                  <img src={imgUrl(p.images[0].url)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-gray-200" /></div>
                )}
                {p.compare_at_price && p.compare_at_price > p.price && (
                  <span className="absolute top-2 left-2 text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: c.accent }}>
                    -{Math.round((1 - p.price / p.compare_at_price) * 100)}%
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{p.name}</h3>
                {(p.avg_rating ?? 0) > 0 && (
                  <div className="mt-1"><StarRating rating={p.avg_rating!} size="sm" showValue reviewCount={p.review_count} /></div>
                )}
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  {(() => {
                    const variants = (p.variants || []).filter((v: any) => v.is_active !== false)
                    const effectivePrice = p.price > 0 ? p.price : variants.length > 0 ? Math.min(...variants.map((v: any) => v.price)) : 0
                    const showFrom = p.price === 0 && variants.length > 0
                    return (
                      <>
                        {showFrom && <span className="text-xs text-gray-500">From</span>}
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(effectivePrice)}</span>
                        {p.compare_at_price && p.compare_at_price > effectivePrice && (
                          <span className="text-sm text-gray-400 line-through">{formatCurrency(p.compare_at_price)}</span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function FeaturedServicesSection({ props, theme, storePath, services }: {
  props: SectionProps
  theme: ReturnType<typeof useTheme>
  storePath: (p: string) => string
  services: any
}) {
  const c = theme.colors
  const hiddenFields = (props.hidden_fields as string[]) || []
  const show = (key: string) => !hiddenFields.includes(key)

  if (!services?.items?.length) return null
  return (
    <section className="bg-white py-10">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.title, 'Our Services')}</h2>
            {show('subtitle') && (
              <p className="text-sm text-gray-600 mt-0.5">
                {str(props.subtitle as string, 'Professional services tailored for you')}
              </p>
            )}
          </div>
          <Link to={storePath('/services')} className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: linkOnLight(c.primary, c.secondary) }}>
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {services.items.map((s: any) => (
            <Link key={s.id} to={storePath(`/services/${s.slug}`)}
              className="group flex gap-4 rounded-xl p-5 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md transition-all shadow-sm" style={{ backgroundColor: theme.colors.background }}>
              {show('card_image') && (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-white border-2 border-gray-200 overflow-hidden shrink-0">
                  {(s.image_url || s.gallery?.[0]) ? (
                    <img src={imgUrl(s.image_url || s.gallery?.[0])} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Wrench className="w-8 h-8" style={{ color: linkOnLight(c.primary, c.secondary) + '99' }} /></div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
                {show('card_rating') && (s.avg_rating ?? 0) > 0 && (
                  <div className="mt-1"><StarRating rating={s.avg_rating!} size="sm" showValue reviewCount={s.review_count} /></div>
                )}
                {show('card_description') && (
                  <p className="text-base text-gray-600 line-clamp-2 mt-1.5">{s.description}</p>
                )}
                {(show('card_price') || show('card_duration')) && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {show('card_price') && (
                      s.price
                        ? <span className="text-base font-bold" style={{ color: linkOnLight(c.primary, c.secondary) }}>{formatCurrency(s.price)}</span>
                        : <span className="text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">Get Quote</span>
                    )}
                    {show('card_duration') && s.duration_minutes && (
                      <span className="text-sm text-gray-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {s.duration_minutes} min</span>
                    )}
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 self-center shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const reviews = [
    { name: 'Happy Customer', text: 'Great products and amazing service! Highly recommended.', rating: 5 },
    { name: 'Satisfied Buyer', text: 'Fast delivery and excellent quality. Will definitely shop again.', rating: 5 },
    { name: 'Regular Customer', text: 'Best store in the area. Professional and reliable.', rating: 4 },
  ]
  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8">{str(props.title, 'What Our Customers Say')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reviews.map((t, i) => (
          <div key={i} className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
            <Quote className="w-7 h-7 mb-4 text-gray-300" aria-hidden />
            <p className="text-base text-gray-700 leading-relaxed">"{t.text}"</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: colors.primary, color: textOnSolid(colors.primary) }}>{t.name[0]}</div>
              <div>
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="w-3 h-3" style={{ color: s < t.rating ? colors.accent : '#d1d5db' }} fill={s < t.rating ? colors.accent : 'none'} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AboutUsSection({ props, colors, vendor }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; vendor: ReturnType<typeof useVendor>['vendor'] }) {
  const headline = str(props.headline, 'About Us')
  const subtitle = str(props.subtitle, vendor?.description || 'Our story and mission')
  return (
    <section className="py-12" style={{ backgroundColor: colors.background }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{headline}</h2>
          <p className="mt-4 text-gray-600 text-lg leading-relaxed">{subtitle}</p>
          <div className="mt-8 grid grid-cols-3 gap-6 text-center">
            {[
              { icon: Users, label: 'Happy Customers', value: '1,000+' },
              { icon: ShoppingBag, label: 'Products', value: '500+' },
              { icon: Star, label: 'Avg Rating', value: '4.8â˜…' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 border">
                <s.icon className="w-6 h-6 mx-auto mb-2" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactMapSection({ props, colors, vendor }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; vendor: ReturnType<typeof useVendor>['vendor'] }) {
  const address = [vendor?.street_address, vendor?.city, vendor?.state, vendor?.postal_code].filter(Boolean).join(', ')
  return (
    <section className="py-10 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8">{str(props.title, 'Find Us')}</h2>
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            {address && (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-gray-50">
                <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</p>
                  <p className="text-gray-800 mt-0.5">{address}</p>
                </div>
              </div>
            )}
            {vendor?.primary_phone && (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-gray-50">
                <Phone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                  <a href={`tel:${vendor.primary_phone}`} className="text-gray-800 hover:underline mt-0.5">{vendor.primary_phone}</a>
                </div>
              </div>
            )}
            {vendor?.primary_email && (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-gray-50">
                <Mail className="w-5 h-5 mt-0.5 shrink-0" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                  <a href={`mailto:${vendor.primary_email}`} className="text-gray-800 hover:underline mt-0.5">{vendor.primary_email}</a>
                </div>
              </div>
            )}
          </div>
          {vendor?.latitude && vendor?.longitude ? (
            <div className="rounded-xl overflow-hidden border h-64">
              <iframe
                title="Store Location"
                width="100%" height="100%"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${vendor.latitude},${vendor.longitude}&z=15&output=embed`}
              />
            </div>
          ) : (
            <div className="rounded-xl border h-64 bg-gray-100 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Location not configured</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function NewsletterSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  return (
    <section className="py-12" style={{ background: `linear-gradient(135deg, ${colors.primary}08, ${colors.accent}08)` }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center">
          <Mail className="w-10 h-10 mx-auto mb-4" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.headline, 'Stay in the loop')}</h2>
          <p className="text-gray-500 mt-2">{str(props.subtitle, 'Get exclusive deals first')}</p>
          {done ? (
            <p className="mt-6 text-green-600 font-medium">âœ“ Thanks for subscribing!</p>
          ) : (
            <form className="mt-6 flex gap-2 max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); setDone(true) }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="Your email address"
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: colors.primary }}
              />
              <Button type="submit" className="shrink-0" style={{ backgroundColor: colors.primary, color: textOnSolid(colors.primary) }}>
                <Send className="w-4 h-4 mr-1" /> Subscribe
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function JobBoardSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <section className="py-10 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Briefcase className="w-10 h-10 mx-auto mb-4" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.title, 'Join Our Team')}</h2>
        <p className="text-gray-500 mt-2">We're always looking for talented people.</p>
        <a href="/careers" target="_blank" rel="noopener noreferrer">
          <Button className="mt-6 gap-2" style={{ backgroundColor: colors.primary, color: textOnSolid(colors.primary) }}>
            <ExternalLink className="w-4 h-4" /> View Open Positions
          </Button>
        </a>
      </div>
    </section>
  )
}

function ESSLoginSection({
  props,
  colors,
  storePath,
  branchParam,
}: {
  props: SectionProps
  colors: ReturnType<typeof useTheme>['colors']
  storePath: (p: string) => string
  branchParam?: string
}) {
  const loginHref =
    `${storePath('/hr/login')}${branchParam ? `?branch=${encodeURIComponent(branchParam)}` : ''}`
  return (
    <section className="py-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-sm mx-auto rounded-2xl border p-6 text-center shadow-sm" style={{ borderColor: colors.primary + '30', background: colors.primary + '06' }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
            <Users className="w-7 h-7" style={{ color: textOnSolid(colors.primary) }} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{str(props.headline, 'Employee Portal')}</h3>
          <p className="text-sm text-gray-600 mt-1">{str(props.subtitle, 'Access your self-service dashboard')}</p>
          <Link to={loginHref}>
            <Button className="mt-4 w-full" style={{ backgroundColor: colors.primary, color: textOnSolid(colors.primary) }}>
              Employee Login
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

function CTABannerSection({ props, colors, storePath, isAuthenticated, buttonRadius }: {
  props: SectionProps
  colors: ReturnType<typeof useTheme>['colors']
  storePath: (p: string) => string
  isAuthenticated: boolean
  buttonRadius?: string
}) {
  const br = radiusClass(buttonRadius)
  const primaryLabel = str(props.cta_primary, 'Browse Products')
  const secondaryLabel = str(props.cta_secondary, 'Create Account')
  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div
        className="rounded-2xl p-8 sm:p-12 text-white text-center shadow-md"
        style={{ background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.primary} 50%, ${colors.secondary}e8 100%)` }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold">{str(props.headline, 'Ready to get started?')}</h2>
        <p className="mt-3 max-w-md mx-auto text-base text-white/95">
          {str(props.subtitle, 'Sign up today and enjoy exclusive deals, fast delivery, and more.')}
        </p>
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <Link to={storePath('/products')}>
            <Button
              size="lg"
              className={`h-12 px-8 text-base font-bold shadow-md border-0 ${br}`}
              style={{ backgroundColor: '#ffffff', color: linkOnLight(colors.primary, colors.secondary) }}
            >
              {primaryLabel}
            </Button>
          </Link>
          {!isAuthenticated && (
            <Link to={storePath('/register')}>
              <Button
                size="lg"
                variant="outline"
                className={`h-12 px-8 text-base font-semibold border-2 border-white bg-white/10 text-white hover:bg-white/20 ${br}`}
              >
                {secondaryLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

function CategoryShowcaseSection({ props, colors, storePath }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; storePath: (p: string) => string }) {
  const categories = ['All Products', 'New Arrivals', 'Best Sellers', 'On Sale']
  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{str(props.title, 'Shop by Category')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link key={cat} to={storePath('/products')}
            className="group rounded-xl border p-6 text-center hover:shadow-md transition-all cursor-pointer"
            style={{ borderColor: colors.primary + '20', background: colors.primary + '06' }}>
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 group-hover:scale-110 transition-transform" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
            <p className="text-sm font-semibold text-gray-800">{cat}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STORE LOCATOR SECTION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface StoreLocatorConfig {
  limit?: number           // 0 = all
  geo?: boolean
  layout?: 'grid' | 'list'
  filter?: 'none' | 'city'
}

function StoreLocatorSection({
  props, colors, config, highlightBranch,
}: {
  props: SectionProps
  colors: ReturnType<typeof useTheme>['colors']
  config: StoreLocatorConfig
  highlightBranch?: string
}) {
  const [branches, setBranches] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [activeCity, setActiveCity] = useState<string>('All')
  const sectionRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  const title = str(props.title as string | undefined, 'Find a Store Near You')
  const limit = config.limit ?? 6
  const layout = config.layout ?? 'grid'
  const filterMode = config.filter ?? 'none'
  const geoEnabled = config.geo ?? false

  useEffect(() => {
    storeApi.listBranches().then(r => {
      setBranches(r.stores)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Scroll to this section and highlight the matching branch when ?branch= is in the URL
  useEffect(() => {
    if (!highlightBranch || loading || !branches.length) return
    const match = branches.find(b => b.code === highlightBranch || b.id === highlightBranch)
    if (!match) return
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }, [highlightBranch, loading, branches])

  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setGeoError('Location access denied'),
      { timeout: 8000 },
    )
  }, [])

  useEffect(() => {
    if (geoEnabled) requestGeo()
  }, [geoEnabled, requestGeo])

  const cities = useMemo(() => {
    const cs = Array.from(new Set(branches.map(b => b.address?.city).filter(Boolean))) as string[]
    return ['All', ...cs.sort()]
  }, [branches])

  const displayed = useMemo(() => {
    let list = [...branches]

    // city filter
    if (filterMode === 'city' && activeCity !== 'All') {
      list = list.filter(b => b.address?.city === activeCity)
    }

    // geo sort
    if (userPos) {
      // simple lat/lon approximation â€” stores without coords keep original order
      list.sort((a, b) => {
        const aCity = a.address?.city ?? ''
        const bCity = b.address?.city ?? ''
        // can't compute exact distance without coordinates per-store; sort default first, rest alphabetically
        if (a.is_default) return -1
        if (b.is_default) return 1
        return aCity.localeCompare(bCity)
      })
    }

    return limit === 0 ? list : list.slice(0, limit)
  }, [branches, activeCity, filterMode, userPos, limit])

  if (loading) {
    return (
      <section className="py-12 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
        </div>
      </section>
    )
  }

  if (!branches.length) return null

  return (
    <section ref={sectionRef} className="py-12 bg-gray-50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
            {branches.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">{branches.length} location{branches.length !== 1 ? 's' : ''} available</p>
            )}
          </div>
          {geoEnabled && (
            <button
              onClick={requestGeo}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: linkOnLight(colors.primary, colors.secondary) + '50', color: linkOnLight(colors.primary, colors.secondary) }}
            >
              <Navigation className="w-4 h-4" />
              {userPos ? 'Location detected' : geoError ?? 'Find nearest store'}
            </button>
          )}
        </div>

        {/* City filter tabs */}
        {filterMode === 'city' && cities.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setActiveCity(city)}
                className="text-sm px-4 py-1.5 rounded-full border font-medium transition-colors"
                style={
                  activeCity === city
                    ? { backgroundColor: colors.primary, borderColor: colors.primary, color: textOnSolid(colors.primary) }
                    : { borderColor: '#e5e7eb', color: '#374151' }
                }
              >
                {city}
              </button>
            ))}
          </div>
        )}

        {/* Store cards */}
        <div className={layout === 'list'
          ? 'space-y-3'
          : 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4'
        }>
          {displayed.map(store => {
            const addr = [store.address?.street, store.address?.city, store.address?.state, store.address?.pincode]
              .filter(Boolean).join(', ')
            const isHighlighted = !!highlightBranch && (store.code === highlightBranch || store.id === highlightBranch)

            if (layout === 'list') {
              return (
                <div
                  key={store.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className="flex items-start gap-4 bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow max-h-[90vh] overflow-y-auto"
                  style={isHighlighted ? { borderColor: colors.primary, boxShadow: `0 0 0 2px ${colors.primary}30` } : undefined}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.primary + '15' }}>
                    <MapPin className="w-5 h-5" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      {store.is_default && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '15', color: linkOnLight(colors.primary, colors.secondary) }}>
                          Main
                        </span>
                      )}
                      {isHighlighted && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primary, color: textOnSolid(colors.primary) }}>
                          Your store
                        </span>
                      )}
                    </div>
                    {addr && <p className="text-sm text-gray-600 mt-0.5 truncate">{addr}</p>}
                    <div className="flex flex-wrap gap-4 mt-2">
                      {store.phone && (
                        <a href={`tel:${store.phone}`} className="flex items-center gap-1 text-xs text-gray-600 hover:underline">
                          <Phone className="w-3 h-3" />{store.phone}
                        </a>
                      )}
                      {store.email && (
                        <a href={`mailto:${store.email}`} className="flex items-center gap-1 text-xs text-gray-600 hover:underline">
                          <Mail className="w-3 h-3" />{store.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={store.id}
                ref={isHighlighted ? highlightRef : undefined}
                className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-3 overflow-hidden"
                style={isHighlighted ? { borderColor: colors.primary, boxShadow: `0 0 0 2px ${colors.primary}30` } : undefined}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.primary + '15' }}>
                    <MapPin className="w-5 h-5" style={{ color: linkOnLight(colors.primary, colors.secondary) }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      {store.is_default && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '15', color: linkOnLight(colors.primary, colors.secondary) }}>
                          Main
                        </span>
                      )}
                      {isHighlighted && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primary, color: textOnSolid(colors.primary) }}>
                          Your store
                        </span>
                      )}
                    </div>
                    {store.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{store.description}</p>}
                  </div>
                </div>

                {addr && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
                    <span>{addr}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {store.phone && (
                    <a href={`tel:${store.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:underline">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />{store.phone}
                    </a>
                  )}
                  {store.email && (
                    <a href={`mailto:${store.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:underline">
                      <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="truncate">{store.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* "Show all" prompt if capped */}
        {limit > 0 && branches.length > limit && filterMode !== 'city' && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Showing {displayed.length} of {branches.length} locations
          </p>
        )}
      </div>
    </section>
  )
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN HOME COMPONENT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Home() {
  const { vendor } = useVendor()
  const { storePath } = useBranch()
  const theme = useTheme()
  const { isAuthenticated } = useAuthStore()
  const { data: products, isLoading: productsLoading } = useProducts({ page: 1, size: 8 })
  const { data: services } = useServices({ page: 1, size: 6 })
  const [searchParams] = useSearchParams()
  const branchParam = searchParams.get('branch') ?? undefined

  const c = theme.colors
  const templateId = theme.template
  const legacySec = theme.sections

  const sectionsToRender: HomeSection[] = [
    legacySec.hero !== false && { id: 'hero', visible: true, props: {} },
    legacySec.trust_badges !== false && { id: 'trust_badges', visible: true, props: {} },
    legacySec.offers_banner !== false && { id: 'offers_banner', visible: true, props: {} },
    legacySec.featured_products !== false && { id: 'featured_products', visible: true, props: {} },
    legacySec.featured_services !== false && { id: 'featured_services', visible: true, props: {} },
    legacySec.testimonials !== false && { id: 'testimonials', visible: true, props: {} },
    legacySec.cta !== false && { id: 'cta_banner', visible: true, props: {} },
  ].filter(Boolean) as HomeSection[]

  return (
    <div className="text-gray-900" style={{ fontFamily: theme.font_body || theme.font, backgroundColor: c.background }}>
      {sectionsToRender.map((section, idx) => {
        const p = section.props || {}
        const renderId = section.id.replace(/_copy$/, '')

        switch (renderId) {
          case 'hero':
            return <div key={`${section.id}-${idx}`}><HeroSection props={p} theme={theme} vendor={vendor} storePath={storePath} builderTemplateId={templateId} /></div>
          case 'trust_badges':
            return <div key={`${section.id}-${idx}`}><TrustBadgesSection props={p} colors={c} /></div>
          case 'offers_banner':
            return <div key={`${section.id}-${idx}`}><OffersBannerSection props={p} colors={c} storePath={storePath} /></div>
          case 'featured_products':
            return <div key={`${section.id}-${idx}`}><FeaturedProductsSection props={p} theme={theme} storePath={storePath} products={products} isLoading={productsLoading} templateId={templateId} /></div>
          case 'featured_services':
            return <div key={`${section.id}-${idx}`}><FeaturedServicesSection props={p} theme={theme} storePath={storePath} services={services} /></div>
          case 'category_showcase':
            return <div key={`${section.id}-${idx}`}><CategoryShowcaseSection props={p} colors={c} storePath={storePath} /></div>
          case 'testimonials':
            return <div key={`${section.id}-${idx}`}><TestimonialsSection props={p} colors={c} /></div>
          case 'about_us':
            return <div key={`${section.id}-${idx}`}><AboutUsSection props={p} colors={c} vendor={vendor} /></div>
          case 'contact_map':
            return <div key={`${section.id}-${idx}`}><ContactMapSection props={p} colors={c} vendor={vendor} /></div>
          case 'newsletter':
            return <div key={`${section.id}-${idx}`}><NewsletterSection props={p} colors={c} /></div>
          case 'job_board':
            return <div key={`${section.id}-${idx}`}><JobBoardSection props={p} colors={c} /></div>
          case 'ess_login_card':
            return <div key={`${section.id}-${idx}`}><ESSLoginSection props={p} colors={c} storePath={storePath} branchParam={branchParam} /></div>
          case 'cta_banner':
            return <div key={`${section.id}-${idx}`}><CTABannerSection props={p} colors={c} storePath={storePath} isAuthenticated={isAuthenticated} buttonRadius={theme.button_radius} /></div>
          case 'store_locator':
            return (
              <div key={`${section.id}-${idx}`}>
                <StoreLocatorSection
                  props={p}
                  colors={c}
                  highlightBranch={branchParam}
                  config={{ limit: 6, geo: false, layout: 'grid', filter: 'none' }}
                />
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
