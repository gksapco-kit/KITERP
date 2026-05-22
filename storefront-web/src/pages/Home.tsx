import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useProducts, useServices } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, imgUrl } from '@/lib/utils'
import {
  ArrowRight, ShoppingBag, Wrench, Loader2, Star, Truck, ShieldCheck,
  RefreshCw, Headphones, Clock, ChevronRight, Quote, MapPin, Phone,
  Mail, Briefcase, Users, ExternalLink, Send, Navigation,
  BarChart3, HelpCircle, CreditCard, Camera, FileText, PlayCircle, Globe, Calendar,
  X as XIcon, Heart, Brain, Eye, Activity, Stethoscope, Baby,
} from 'lucide-react'
import StarRating from '@/components/StarRating'
import { storeApi, type StoreLocation } from '@/api/store'
import { StorefrontMarquee } from '@/components/storefront-ui/StorefrontMarquee'
import type { SectionProps } from '@/home-sections/types'
import {
  HeroSection,
  RestaurantMenuSection,
  str,
  editorialKitFromTemplate,
  accentInText,
  storefrontHref,
  radiusClass,
  heroHeightClass,
} from '@/home-sections'

// ── Types ──────────────────────────────────────────────────────────────────────
interface BuilderSection { id: string; visible: boolean; props: SectionProps }
interface BuilderConfig {
  template_id?: string
  sections?: BuilderSection[]
  style?: Record<string, unknown>
  modules?: Record<string, unknown>
  seo?: Record<string, unknown>
  product_detail_template?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TrustBadgesSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const badges = [
    { icon: Truck, text: str(props.badge_1, 'Free Shipping') },
    { icon: ShieldCheck, text: str(props.badge_2, 'Secure Payment') },
    { icon: RefreshCw, text: str(props.badge_3, 'Easy Returns') },
    { icon: Headphones, text: str(props.badge_4, '24/7 Support') },
  ]
  return (
    <div className="bg-white border-b">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
          {badges.map((b) => (
            <div key={b.text} className="flex items-center gap-2 justify-center text-sm text-gray-600">
              <b.icon className="w-4 h-4" style={{ color: colors.primary }} />
              <span className="font-medium">{b.text}</span>
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
        <p className="text-sm text-gray-500 mt-1">{str(props.subtitle, 'Check out our latest deals and discounts')}</p>
        <Link to={storePath('/products')}>
          <Button size="sm" className="mt-3 text-white" style={{ backgroundColor: colors.accent }}>View Offers <ArrowRight className="w-4 h-4 ml-1" /></Button>
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
          <Link to={viewAll} className="text-sm border-b border-retail-ink/30 pb-1">See all →</Link>
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
          <p className="text-sm text-gray-500 mt-0.5">Discover our top picks for you</p>
        </div>
        <Link to={storePath('/products')} className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: c.primary }}>
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
              className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-200 overflow-hidden">
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
              <div className="p-3 sm:p-4">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{p.name}</h3>
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
              <p className="text-sm text-gray-500 mt-0.5">
                {str(props.subtitle as string, 'Professional services tailored for you')}
              </p>
            )}
          </div>
          <Link to={storePath('/services')} className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: c.primary }}>
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {services.items.map((s: any) => (
            <Link key={s.id} to={storePath(`/services/${s.slug}`)}
              className="group flex gap-4 rounded-xl p-4 border hover:shadow-md transition-all" style={{ backgroundColor: theme.colors.background }}>
              {show('card_image') && (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-white border overflow-hidden shrink-0">
                  {(s.image_url || s.gallery?.[0]) ? (
                    <img src={imgUrl(s.image_url || s.gallery?.[0])} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Wrench className="w-8 h-8" style={{ color: c.primary + '40' }} /></div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{s.name}</h3>
                {show('card_rating') && (s.avg_rating ?? 0) > 0 && (
                  <div className="mt-0.5"><StarRating rating={s.avg_rating!} size="sm" showValue reviewCount={s.review_count} /></div>
                )}
                {show('card_description') && (
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{s.description}</p>
                )}
                {(show('card_price') || show('card_duration')) && (
                  <div className="mt-2 flex items-center gap-3">
                    {show('card_price') && (
                      s.price
                        ? <span className="text-sm font-bold" style={{ color: c.primary }}>{formatCurrency(s.price)}</span>
                        : <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Get Quote</span>
                    )}
                    {show('card_duration') && s.duration_minutes && (
                      <span className="text-xs text-gray-500 flex items-center gap-0.5"><Clock className="w-3 h-3" /> {s.duration_minutes} min</span>
                    )}
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 self-center shrink-0" />
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
          <div key={i} className="bg-white rounded-xl border p-6">
            <Quote className="w-8 h-8 mb-3" style={{ color: colors.accent + '60' }} />
            <p className="text-sm text-gray-600 italic">"{t.text}"</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: colors.primary }}>{t.name[0]}</div>
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
              { icon: Star, label: 'Avg Rating', value: '4.8★' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 border">
                <s.icon className="w-6 h-6 mx-auto mb-2" style={{ color: colors.primary }} />
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
                <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: colors.primary }} />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</p>
                  <p className="text-gray-800 mt-0.5">{address}</p>
                </div>
              </div>
            )}
            {vendor?.primary_phone && (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-gray-50">
                <Phone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: colors.primary }} />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                  <a href={`tel:${vendor.primary_phone}`} className="text-gray-800 hover:underline mt-0.5">{vendor.primary_phone}</a>
                </div>
              </div>
            )}
            {vendor?.primary_email && (
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-gray-50">
                <Mail className="w-5 h-5 mt-0.5 shrink-0" style={{ color: colors.primary }} />
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
          <Mail className="w-10 h-10 mx-auto mb-4" style={{ color: colors.primary }} />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.headline, 'Stay in the loop')}</h2>
          <p className="text-gray-500 mt-2">{str(props.subtitle, 'Get exclusive deals first')}</p>
          {done ? (
            <p className="mt-6 text-green-600 font-medium">✓ Thanks for subscribing!</p>
          ) : (
            <form className="mt-6 flex gap-2 max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); setDone(true) }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="Your email address"
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: colors.primary }}
              />
              <Button type="submit" className="text-white shrink-0" style={{ backgroundColor: colors.primary }}>
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
        <Briefcase className="w-10 h-10 mx-auto mb-4" style={{ color: colors.primary }} />
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.title, 'Join Our Team')}</h2>
        <p className="text-gray-500 mt-2">We're always looking for talented people.</p>
        <a href="/careers" target="_blank" rel="noopener noreferrer">
          <Button className="mt-6 text-white gap-2" style={{ backgroundColor: colors.primary }}>
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
            <Users className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{str(props.headline, 'Employee Portal')}</h3>
          <p className="text-sm text-gray-500 mt-1">{str(props.subtitle, 'Access your self-service dashboard')}</p>
          <Link to={loginHref}>
            <Button className="mt-4 w-full text-white" style={{ backgroundColor: colors.primary }}>
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
  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="rounded-2xl p-8 sm:p-12 text-white text-center" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
        <h2 className="text-2xl sm:text-3xl font-bold">{str(props.headline, 'Ready to get started?')}</h2>
        <p className="mt-2 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {str(props.subtitle, 'Sign up today and enjoy exclusive deals, fast delivery, and more.')}
        </p>
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <Link to={storePath('/products')}>
            <Button size="lg" className={`font-bold ${br}`} style={{ backgroundColor: colors.accent, color: '#1e293b' }}>
              {str(props.cta_primary, 'Browse Products')}
            </Button>
          </Link>
          {!isAuthenticated && (
            <Link to={storePath('/register')}>
              <Button size="lg" variant="outline" className={`border-white/50 text-white hover:bg-white/10 ${br}`}>Create Account</Button>
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
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 group-hover:scale-110 transition-transform" style={{ color: colors.primary }} />
            <p className="text-sm font-semibold text-gray-800">{cat}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE LOCATOR SECTION
// ─────────────────────────────────────────────────────────────────────────────

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
      // simple lat/lon approximation — stores without coords keep original order
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
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: colors.primary }} />
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
              <p className="text-sm text-gray-500 mt-1">{branches.length} location{branches.length !== 1 ? 's' : ''} available</p>
            )}
          </div>
          {geoEnabled && (
            <button
              onClick={requestGeo}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: colors.primary + '50', color: colors.primary }}
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
                    ? { backgroundColor: colors.primary, borderColor: colors.primary, color: '#fff' }
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
                  className="flex items-start gap-4 bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow"
                  style={isHighlighted ? { borderColor: colors.primary, boxShadow: `0 0 0 2px ${colors.primary}30` } : undefined}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.primary + '15' }}>
                    <MapPin className="w-5 h-5" style={{ color: colors.primary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      {store.is_default && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '15', color: colors.primary }}>
                          Main
                        </span>
                      )}
                      {isHighlighted && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: colors.primary }}>
                          Your store
                        </span>
                      )}
                    </div>
                    {addr && <p className="text-sm text-gray-500 mt-0.5 truncate">{addr}</p>}
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
                className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
                style={isHighlighted ? { borderColor: colors.primary, boxShadow: `0 0 0 2px ${colors.primary}30` } : undefined}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.primary + '15' }}>
                    <MapPin className="w-5 h-5" style={{ color: colors.primary }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      {store.is_default && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '15', color: colors.primary }}>
                          Main
                        </span>
                      )}
                      {isHighlighted && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: colors.primary }}>
                          Your store
                        </span>
                      )}
                    </div>
                    {store.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{store.description}</p>}
                  </div>
                </div>

                {addr && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                    <span>{addr}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {store.phone && (
                    <a href={`tel:${store.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:underline">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />{store.phone}
                    </a>
                  )}
                  {store.email && (
                    <a href={`mailto:${store.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:underline">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
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
          <p className="text-center text-sm text-gray-400 mt-6">
            Showing {displayed.length} of {branches.length} locations
          </p>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW SECTION COMPONENTS (added by business front builder)
// ─────────────────────────────────────────────────────────────────────────────

function AnnouncementBarSection({ props }: { props: SectionProps }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const color = str(props.announcement_color as string, '#64C3A0')
  return (
    <div className="relative text-center py-2.5 px-8 text-sm font-medium text-white" style={{ backgroundColor: color }}>
      {str(props.announcement_text as string, '')}
      {Boolean(props.show_dismiss) && (
        <button type="button" onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100">
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function StatsSection({ props, colors, templateId }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; templateId?: string }) {
  const stats = (['1','2','3','4'] as const)
    .map(n => ({ value: str(props[`stat_${n}_value`] as string), label: str(props[`stat_${n}_label`] as string) }))
    .filter(s => s.value)
  if (!stats.length) return null
  if (editorialKitFromTemplate(templateId) === 'solace') {
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24 bg-hosp-bg">
        <div className="rounded-3xl bg-hosp-accent/10 p-10 md:p-16 grid md:grid-cols-3 gap-10 text-hosp-ink">
          {stats.slice(0, 3).map((s, i) => (
            <div key={i}>
              <div className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-hosp-accent">{s.value}</div>
              <p className="opacity-70 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="py-10 border-y" style={{ background: colors.primary + '08' }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <div key={i}>
              <p className="text-3xl sm:text-4xl font-extrabold" style={{ color: colors.primary }}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const [open, setOpen] = useState<number | null>(0)
  const faqs = (['1','2','3','4'] as const)
    .map(n => ({ q: str(props[`faq_${n}_q`] as string), a: str(props[`faq_${n}_a`] as string) }))
    .filter(f => f.q)
  if (!faqs.length) return null
  return (
    <section className="py-10 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8">{str(props.title as string, 'Frequently Asked Questions')}</h2>
        <div className="max-w-2xl mx-auto space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span>{f.q}</span>
                <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${open === i ? 'rotate-90' : ''}`} style={{ color: colors.primary }} />
              </button>
              {open === i && f.a && (
                <div className="px-4 pb-4 text-sm text-gray-600 border-t pt-3">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection({ props, colors, storePath }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; storePath: (p: string) => string }) {
  const plans = (['1','2','3'] as const).map(n => ({
    name:  str(props[`plan_${n}_name`]  as string, ['Basic','Standard','Premium'][+n-1]),
    price: str(props[`plan_${n}_price`] as string, ['₹999','₹1,999','₹3,999'][+n-1]),
    desc:  str(props[`plan_${n}_desc`]  as string, ''),
    cta:   str(props[`plan_${n}_cta`]   as string, 'Choose'),
    link:  str(props[`plan_${n}_cta_link`] as string, ''),
    highlight: n === '2',
  }))
  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-10">{str(props.title as string, 'Our Plans')}</h2>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((pl, i) => (
            <div key={i} className={`rounded-2xl p-6 flex flex-col ${pl.highlight ? 'shadow-xl scale-105' : 'bg-white border'}`}
              style={pl.highlight ? { background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` } : {}}>
              <p className={`text-sm font-bold uppercase tracking-wider ${pl.highlight ? 'text-white/80' : 'text-gray-500'}`}>{pl.name}</p>
              <p className={`text-3xl font-extrabold mt-2 ${pl.highlight ? 'text-white' : 'text-gray-900'}`}>{pl.price}</p>
              {pl.desc && <p className={`text-sm mt-2 flex-1 ${pl.highlight ? 'text-white/70' : 'text-gray-500'}`}>{pl.desc}</p>}
              <Link to={storePath(pl.link || '/services')}>
                <Button className={`mt-6 w-full font-bold ${pl.highlight ? '' : 'text-white'}`}
                  style={pl.highlight ? { backgroundColor: colors.accent, color: '#1e293b' } : { backgroundColor: colors.primary }}>
                  {pl.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GallerySection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const cols = parseInt(str(props.columns as string, '3'))
  const imgs = (['1','2','3','4','5','6'] as const).map(n => str(props[`image_${n}`] as string)).filter(Boolean)
  if (!imgs.length) return null
  const gridClass = cols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
  return (
    <section className="py-10">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {(props.title as string) && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{props.title as string}</h2>}
        <div className={`grid ${gridClass} gap-3`}>
          {imgs.map((src, i) => (
            <div key={i} className="aspect-square rounded-xl overflow-hidden">
              <img src={imgUrl(src)} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BlogGridSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const placeholders = [
    { title: 'Latest update from our store', date: 'Apr 2026' },
    { title: 'Tips & announcements', date: 'Apr 2026' },
    { title: 'Customer success story', date: 'Mar 2026' },
  ]
  return (
    <section className="py-10 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.title as string, 'Latest News')}</h2>
          {(props.view_all_link as string) && (
            <Link to={str(props.view_all_link as string, '/blog')} className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: colors.primary }}>
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {placeholders.map((a, i) => (
            <div key={i} className="rounded-xl border overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 flex items-center justify-center" style={{ backgroundColor: colors.primary + '10' }}>
                <FileText className="w-10 h-10" style={{ color: colors.primary + '40' }} />
              </div>
              <div className="p-4">
                <p className="font-medium text-gray-900 line-clamp-2">{a.title}</p>
                <p className="text-xs text-gray-400 mt-1">{a.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function VideoEmbedSection({ props }: { props: SectionProps }) {
  const videoUrl = str(props.video_url as string, '')
  const vidH = parseInt(str(props.video_height as string, '320'))
  // Convert watch URL to embed URL
  const embedUrl = videoUrl.includes('youtube.com/watch')
    ? videoUrl.replace('watch?v=', 'embed/')
    : videoUrl.includes('youtu.be/')
    ? videoUrl.replace('youtu.be/', 'www.youtube.com/embed/')
    : videoUrl
  return (
    <section className="py-10">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {(props.title as string) && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6">{props.title as string}</h2>}
        <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl" style={{ height: `${vidH}px` }}>
          {embedUrl ? (
            <iframe src={embedUrl} title={str(props.title as string, 'Video')} width="100%" height="100%" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <PlayCircle className="w-16 h-16 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Add a YouTube or Vimeo URL in the builder</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SocialLinksSection({ props, colors }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors'] }) {
  const networks = [
    { key: 'instagram_url',   label: 'Instagram', color: '#e1306c' },
    { key: 'facebook_url',    label: 'Facebook',  color: '#1877f2' },
    { key: 'youtube_url',     label: 'YouTube',   color: '#ff0000' },
    { key: 'whatsapp_number', label: 'WhatsApp',  color: '#25d366', prefix: 'https://wa.me/' },
    { key: 'twitter_url',     label: 'X / Twitter', color: '#000000' },
    { key: 'linkedin_url',    label: 'LinkedIn',  color: '#0a66c2' },
  ]
  const active = networks.filter(n => props[n.key])
  if (!active.length) return null
  return (
    <section className="py-10 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {(props.title as string) && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{props.title as string}</h2>}
        <div className="flex justify-center gap-3 flex-wrap">
          {active.map(n => {
            const href = n.prefix ? `${n.prefix}${str(props[n.key] as string, '')}` : str(props[n.key] as string, '')
            return (
              <a key={n.key} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm hover:opacity-90 transition-opacity shadow-sm"
                style={{ backgroundColor: n.color }}>
                <Globe className="w-4 h-4" /> {n.label}
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Marquee Ticker (storefront-ui kit) ───────────────────────────────────────
function MarqueeStripSection({ props, colors, templateId }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; templateId?: string }) {
  const items = str(props.items as string, 'Free returns within 30 days,Made in small batches,New drops every Friday,Handcrafted with care')
    .split(',').map(t => t.trim()).filter(Boolean)
  const speed = str(props.speed as string, 'normal')
  const durationSec = speed === 'slow' ? 40 : speed === 'fast' ? 15 : 30
  const kit = editorialKitFromTemplate(templateId)

  if (kit === 'atelier' || kit === 'verde' || kit === 'solace') {
    const wrap =
      kit === 'verde'
        ? 'py-8 border-y border-resto-ink/10 bg-resto-bg'
        : kit === 'solace'
          ? 'py-8 border-y border-hosp-ink/10 bg-hosp-bg'
          : 'py-8 border-y border-retail-ink/10 bg-retail-bg'
    const variant = kit === 'verde' ? 'resto' : kit === 'solace' ? 'hosp' : 'retail'
    return (
      <div className={wrap}>
        <StorefrontMarquee items={items} variant={variant} durationSec={durationSec} />
      </div>
    )
  }

  const duration = speed === 'slow' ? '40s' : speed === 'fast' ? '15s' : '25s'
  const display = [...items, ...items]
  return (
    <div className="border-y overflow-hidden" style={{
      borderColor: colors.primary + '18',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
      maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
    }}>
      <style>{`@keyframes sfTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ display: 'flex', gap: '2.5rem', whiteSpace: 'nowrap', animation: `sfTicker ${duration} linear infinite`, width: 'max-content', padding: '14px 0' }}>
        {display.map((t, i) => (
          <span key={i} className="text-sm font-medium" style={{ color: colors.primary + 'cc' }}>
            {t} <span style={{ opacity: 0.4, marginLeft: '1.5rem' }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Editorial Split (storefront-ui kit) ─────────────────────────────────────
function EditorialSplitSection({ props, colors, theme, templateId, storePath }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; theme: ReturnType<typeof useTheme>; templateId?: string; storePath: (p: string) => string }) {
  const imageSide = str(props.image_side as string, 'left')
  const headline = str(props.headline as string, 'Made slowly, on purpose.')
  const subtitle = str(props.subtitle as string, 'A note from the studio')
  const desc = str(props.description as string, 'Every piece passes through fewer than ten hands. We think that shows.')
  const cta = str(props.cta_primary as string, '')
  const imgSrc = str(props.image_url as string, '')
  const kit = editorialKitFromTemplate(templateId)

  if (kit === 'atelier') {
    const imgEl = imgSrc ? (
      <div className="aspect-[4/5] max-h-[min(48dvh,360px)] overflow-hidden rounded-3xl sm:max-h-none">
        <img src={imgUrl(imgSrc)} alt="" className="h-full w-full object-cover object-center" />
      </div>
    ) : (
      <div className="aspect-[4/5] max-h-[min(48dvh,360px)] rounded-3xl bg-gradient-to-br from-retail-accent/30 to-secondary sm:max-h-none" />
    )
    const ctaHref = storefrontHref(props.cta_primary_link, storePath, '/products')
    const accentWord = str(props.accent_phrase as string, 'on purpose.')
    const textEl = (
      <div>
        {subtitle && <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-4 text-retail-ink">{subtitle}</p>}
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.05] text-retail-ink">
          {headline.split('\n').map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {accentInText(line, accentWord, 'font-serif-it text-retail-accent not-italic')}
            </Fragment>
          ))}
        </h2>
        <p className="text-lg opacity-75 leading-relaxed mb-8 max-w-md text-retail-ink">{desc}</p>
        {cta && (
          <Link to={ctaHref} className="text-sm border-b border-retail-ink/30 pb-1 text-retail-ink inline-block">
            {cta} →
          </Link>
        )}
      </div>
    )
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 bg-retail-bg text-retail-ink">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className={imageSide === 'right' ? 'md:order-2' : ''}>{imgEl}</div>
          <div className={imageSide === 'right' ? 'md:order-1' : ''}>{textEl}</div>
        </div>
      </section>
    )
  }

  if (kit === 'verde') {
    const imgEl = imgSrc ? (
      <div className="aspect-[4/5] max-h-[min(48dvh,360px)] overflow-hidden rounded-3xl border border-resto-ink/15 sm:max-h-none">
        <img src={imgUrl(imgSrc)} alt="" className="h-full w-full object-cover object-center opacity-90" />
      </div>
    ) : (
      <div className="aspect-[4/5] max-h-[min(48dvh,360px)] rounded-3xl border border-resto-ink/10 bg-gradient-to-br from-resto-accent/20 to-resto-bg sm:max-h-none" />
    )
    const ctaHref = storefrontHref(props.cta_primary_link, storePath, '/products')
    const accentWord = str(props.accent_phrase as string, '')
    const textEl = (
      <div>
        {subtitle && <p className="text-xs uppercase tracking-[0.3em] opacity-60 mb-4 text-resto-ink">{subtitle}</p>}
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.05] text-resto-ink">
          {headline.split('\n').map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {accentWord ? accentInText(line, accentWord, 'font-serif-it text-resto-accent not-italic') : line}
            </Fragment>
          ))}
        </h2>
        <p className="text-lg opacity-70 leading-relaxed mb-8 max-w-md text-resto-ink">{desc}</p>
        {cta && (
          <Link to={ctaHref} className="text-sm border-b border-resto-ink/30 pb-1 text-resto-ink inline-block">
            {cta} →
          </Link>
        )}
      </div>
    )
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 bg-resto-bg">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className={imageSide === 'right' ? 'md:order-2' : ''}>{imgEl}</div>
          <div className={imageSide === 'right' ? 'md:order-1' : ''}>{textEl}</div>
        </div>
      </section>
    )
  }

  const textEl = (
    <div className="flex-1 py-6 px-4 sm:px-8">
      {subtitle && <p className="text-xs uppercase tracking-[0.25em] mb-4 font-medium" style={{ color: colors.primary }}>{subtitle}</p>}
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-[1.05] mb-5 text-gray-900" style={{ fontFamily: theme.font }}>{headline}</h2>
      <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-md mb-6">{desc}</p>
      {cta && (
        <span className="inline-block text-sm font-semibold pb-1" style={{ color: colors.primary, borderBottom: `1px solid ${colors.primary}50` }}>
          {cta} →
        </span>
      )}
    </div>
  )

  const imgEl = imgSrc ? (
    <div className="flex-1 min-h-[200px] max-h-[min(52dvh,360px)] overflow-hidden sm:max-h-none sm:min-h-[300px] md:min-h-[380px]">
      <img src={imgUrl(imgSrc)} alt="" className="h-full min-h-[200px] w-full object-cover object-center sm:min-h-[300px]" style={{ borderRadius: '1.5rem' }} />
    </div>
  ) : (
    <div className="flex-1 min-h-[200px] max-h-[min(52dvh,360px)] rounded-3xl sm:max-h-none sm:min-h-[300px] md:min-h-[380px]" style={{ background: `linear-gradient(135deg, ${colors.primary}18, ${colors.accent}14)` }} />
  )

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16">
      <div className={`flex flex-col md:flex-row items-center gap-8 ${imageSide === 'right' ? 'md:flex-row-reverse' : ''}`}>
        {imgEl}
        {textEl}
      </div>
    </section>
  )
}

// ── Specialties Grid (storefront-ui kit for Solace) ───────────────────────────
function SpecialtiesGridSection({ props, colors, theme, storePath, services, templateId }: {
  props: SectionProps
  colors: ReturnType<typeof useTheme>['colors']
  theme: ReturnType<typeof useTheme>
  storePath: (p: string) => string
  services: any
  templateId?: string
}) {
  const icons = [Heart, Stethoscope, Brain, Baby, Eye, Activity, Briefcase, Users]
  const hasServices = (services?.items?.length ?? 0) > 0
  const ctaLabel = str(props.cta_label as string, 'Book →')
  const viewAllLabel = str(props.view_all_label as string, 'All services →')
  const kit = editorialKitFromTemplate(templateId) === 'solace'

  const specialties = hasServices
    ? services.items.slice(0, 6)
    : [
        { id: 1, name: 'Cardiology',       slug: '' },
        { id: 2, name: 'Neurology',        slug: '' },
        { id: 3, name: 'Paediatrics',      slug: '' },
        { id: 4, name: 'Family Medicine',  slug: '' },
        { id: 5, name: 'Ophthalmology',    slug: '' },
        { id: 6, name: 'Diagnostics',      slug: '' },
      ]

  const viewHref = storefrontHref(props.view_all_link, storePath, '/services')

  if (kit) {
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 bg-hosp-bg text-hosp-ink">
        <div className="flex items-end justify-between mb-10">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight">{str(props.title as string, 'Care, by department.')}</h2>
          <Link to={viewHref} className="text-sm border-b border-hosp-ink/30 pb-1">{viewAllLabel}</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-hosp-ink/15 rounded-3xl overflow-hidden">
          {specialties.map((item: any, i: number) => {
            const Icon = icons[i % icons.length]
            const href = item.slug ? storePath(`/services/${item.slug}`) : storePath('/services')
            return (
              <Link key={item.id || i} to={href} className="bg-hosp-bg p-8 hover:bg-hosp-accent/5 transition group">
                <Icon className="w-8 h-8 text-hosp-accent mb-6" />
                <h3 className="font-display text-2xl mb-2">{item.name}</h3>
                <p className="text-sm opacity-70">
                  {item.short_description || 'Same-day & next-day appointments. 12 specialists.'}
                </p>
                <span className="inline-block mt-4 text-sm border-b border-hosp-ink/30 pb-0.5 group-hover:border-hosp-accent">{ctaLabel}</span>
              </Link>
            )
          })}
        </div>
        {!hasServices && <p className="text-center text-sm opacity-50 mt-4 italic">Add Services to your store to populate this grid</p>}
      </section>
    )
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16">
      <div className="flex items-end justify-between mb-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold" style={{ fontFamily: theme.font }}>{str(props.title as string, 'Care, by department.')}</h2>
        <Link to={viewHref} className="text-sm pb-0.5" style={{ color: colors.primary, borderBottom: `1px solid ${colors.primary}40` }}>{viewAllLabel}</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-3xl overflow-hidden" style={{ backgroundColor: colors.primary + '20' }}>
        {specialties.map((item: any, i: number) => {
          const Icon = icons[i % icons.length]
          const href = item.slug ? storePath(`/services/${item.slug}`) : storePath('/services')
          return (
            <Link key={item.id || i} to={href} className="group p-8 hover:opacity-90 transition-all" style={{ backgroundColor: colors.background }}>
              <Icon className="w-8 h-8 mb-5" style={{ color: colors.primary }} />
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: theme.font }}>{item.name}</h3>
              {item.short_description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.short_description}</p>}
              <span className="text-sm pb-0.5 font-medium" style={{ color: colors.primary, borderBottom: `1px solid ${colors.primary}40` }}>{ctaLabel}</span>
            </Link>
          )
        })}
      </div>
      {!hasServices && <p className="text-center text-sm text-gray-400 mt-4 italic">Add Services to your store to populate this grid</p>}
    </section>
  )
}

// ── Trust Strip (storefront-ui kit for Solace) ───────────────────────────────
function TrustStripSection({ props, colors, templateId }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; templateId?: string }) {
  const kit = editorialKitFromTemplate(templateId) === 'solace'
  if (kit) {
    return (
      <section className="bg-hosp-ink text-hosp-bg py-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid sm:grid-cols-3 gap-6 text-sm">
          <div><span className="text-hosp-accent">●</span> {str(props.col_1 as string, 'Emergency open 24/7 · +1 (212) 555 0142')}</div>
          <div className="opacity-80">{str(props.col_2 as string, 'Walk-in lab · Mon–Sat 7:00–19:00')}</div>
          <div className="opacity-80">{str(props.col_3 as string, 'Pharmacy on site')}</div>
        </div>
      </section>
    )
  }
  const bgStyle = str(props.bg_style as string, 'dark')
  const bg = bgStyle === 'accent' ? colors.primary : '#111827'
  const textC = '#d1d5db'

  return (
    <div style={{ backgroundColor: bg, padding: '1rem' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-4 text-sm" style={{ color: textC }}>
        <div style={{ color: colors.accent }}>{str(props.col_1 as string, '● Emergency open 24/7 · call us')}</div>
        <div style={{ opacity: 0.8 }}>{str(props.col_2 as string, 'Walk-in lab · Mon–Sat 7:00–19:00')}</div>
        <div style={{ opacity: 0.8 }}>{str(props.col_3 as string, 'Free consultation available')}</div>
      </div>
    </div>
  )
}

function BookingWidgetSection({ props, colors, storePath }: { props: SectionProps; colors: ReturnType<typeof useTheme>['colors']; storePath: (p: string) => string }) {
  const link = str(props.booking_link as string, '') || storePath('/services')
  return (
    <section className="py-12" style={{ background: `linear-gradient(135deg, ${colors.primary}08, ${colors.accent}08)` }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto rounded-2xl border p-8 text-center bg-white shadow-sm" style={{ borderColor: colors.primary + '20' }}>
          <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: colors.primary }} />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{str(props.title as string, 'Book an Appointment')}</h2>
          {(props.subtitle as string) && <p className="text-gray-500 mt-2">{props.subtitle as string}</p>}
          <Link to={link}>
            <Button size="lg" className="mt-6 text-white font-bold gap-2" style={{ backgroundColor: colors.primary }}>
              <Calendar className="w-5 h-5" /> {str(props.cta_label as string, 'Book Now')}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { vendor, storePath } = useVendor()
  const theme = useTheme()
  const { isAuthenticated } = useAuthStore()
  const { data: products, isLoading: productsLoading } = useProducts({ page: 1, size: 8 })
  const { data: services } = useServices({ page: 1, size: 6 })
  const [searchParams] = useSearchParams()
  const branchParam = searchParams.get('branch') ?? undefined

  const c = theme.colors

  // Try to read builder_config for fully ordered, prop-driven rendering
  const builderConfig = vendor?.theme_config?.builder_config as BuilderConfig | undefined
  const builderSections: BuilderSection[] = builderConfig?.sections ?? []
  const builderModules = builderConfig?.modules as Record<string, unknown> | undefined
  const builderTemplateId = builderConfig?.template_id

  // Fall back to legacy flat sections boolean map
  const legacySec = theme.sections

  // Announcement bar section (rendered above everything, separately)
  const announcementSection = builderSections.find(s => s.id === 'announcement_bar' && s.visible)

  // Build rendering list: builder sections take priority (ordered + props)
  // If no builder config, fall back to the legacy boolean map with default props
  const sectionsToRender: BuilderSection[] = builderSections.length > 0
    ? builderSections.filter(s => s.visible && s.id !== 'announcement_bar')
    : [
        legacySec.hero !== false && { id: 'hero', visible: true, props: {} },
        legacySec.trust_badges !== false && { id: 'trust_badges', visible: true, props: {} },
        legacySec.offers_banner !== false && { id: 'offers_banner', visible: true, props: {} },
        legacySec.featured_products !== false && { id: 'featured_products', visible: true, props: {} },
        legacySec.featured_services !== false && { id: 'featured_services', visible: true, props: {} },
        legacySec.testimonials !== false && { id: 'testimonials', visible: true, props: {} },
        legacySec.cta !== false && { id: 'cta_banner', visible: true, props: {} },
      ].filter(Boolean) as BuilderSection[]

  return (
    <div style={{ fontFamily: theme.font, backgroundColor: c.background }}>
      {/* Announcement bar — always at top, outside section loop */}
      {announcementSection && <AnnouncementBarSection props={announcementSection.props} />}

      {sectionsToRender.map((section, idx) => {
        const p = section.props || {}
        // Duplicated sections have ids like "hero_copy" — strip suffix to match renderer
        const renderId = section.id.replace(/_copy$/, '')

        // Per-section style overrides set in the builder
        const bgOverride   = p._bg_color   as string | undefined
        const textOverride = p._text_color  as string | undefined
        const padTop       = parseInt((p._padding_top    as string) || '0') || 0
        const padBottom    = parseInt((p._padding_bottom as string) || '0') || 0
        const hasOverride  = !!(bgOverride || textOverride || padTop || padBottom)

        const inner = (() => {
          switch (renderId) {
            case 'hero':
              return <HeroSection props={p} theme={theme} vendor={vendor} storePath={storePath} builderTemplateId={builderTemplateId} />
            case 'trust_badges':
              return <TrustBadgesSection props={p} colors={c} />
            case 'offers_banner':
              return <OffersBannerSection props={p} colors={c} storePath={storePath} />
            case 'featured_products':
              return <FeaturedProductsSection props={p} theme={theme} storePath={storePath} products={products} isLoading={productsLoading} templateId={builderTemplateId} />
            case 'featured_services':
              return <FeaturedServicesSection props={p} theme={theme} storePath={storePath} services={services} />
            case 'category_showcase':
              return <CategoryShowcaseSection props={p} colors={c} storePath={storePath} />
            case 'testimonials':
              return <TestimonialsSection props={p} colors={c} />
            case 'about_us':
              return <AboutUsSection props={p} colors={c} vendor={vendor} />
            case 'contact_map':
              return <ContactMapSection props={p} colors={c} vendor={vendor} />
            case 'newsletter':
              return <NewsletterSection props={p} colors={c} />
            case 'job_board':
              return <JobBoardSection props={p} colors={c} />
            case 'ess_login_card':
              return <ESSLoginSection props={p} colors={c} storePath={storePath} branchParam={branchParam} />
            case 'cta_banner':
              return <CTABannerSection props={p} colors={c} storePath={storePath} isAuthenticated={isAuthenticated} buttonRadius={theme.button_radius} />
            case 'store_locator':
              return (
                <StoreLocatorSection
                  props={p}
                  colors={c}
                  highlightBranch={branchParam}
                  config={{
                    limit: (builderModules?.store_locator_limit as number | undefined) ?? 6,
                    geo: (builderModules?.store_locator_geo as boolean | undefined) ?? false,
                    layout: (builderModules?.store_locator_layout as 'grid' | 'list' | undefined) ?? 'grid',
                    filter: (builderModules?.store_locator_filter as 'none' | 'city' | undefined) ?? 'none',
                  }}
                />
              )
            // ── New sections added via business front builder ──
            case 'stats':
              return <StatsSection props={p} colors={c} templateId={builderTemplateId} />
            case 'faq':
              return <FAQSection props={p} colors={c} />
            case 'pricing':
              return <PricingSection props={p} colors={c} storePath={storePath} />
            case 'gallery':
              return <GallerySection props={p} colors={c} />
            case 'blog_grid':
              return <BlogGridSection props={p} colors={c} />
            case 'video_embed':
              return <VideoEmbedSection props={p} />
            case 'social_links':
              return <SocialLinksSection props={p} colors={c} />
            case 'booking_widget':
              return <BookingWidgetSection props={p} colors={c} storePath={storePath} />
            // ── Editorial & vertical template sections ────────────────────
            case 'marquee_strip':
              return <MarqueeStripSection props={p} colors={c} templateId={builderTemplateId} />
            case 'editorial_split':
              return <EditorialSplitSection props={p} colors={c} theme={theme} templateId={builderTemplateId} storePath={storePath} />
            case 'restaurant_menu':
              return <RestaurantMenuSection props={p} colors={c} theme={theme} products={products} isLoading={productsLoading} templateId={builderTemplateId} storePath={storePath} />
            case 'specialties_grid':
              return <SpecialtiesGridSection props={p} colors={c} theme={theme} storePath={storePath} services={services} templateId={builderTemplateId} />
            case 'trust_strip':
              return <TrustStripSection props={p} colors={c} templateId={builderTemplateId} />
            default:
              return null
          }
        })()

        if (!inner) return null

        // Wrap with style overrides if any were set in the builder
        return hasOverride ? (
          <div key={`${section.id}-${idx}`} style={{
            ...(bgOverride   ? { backgroundColor: bgOverride } : {}),
            ...(textOverride ? { color: textOverride }         : {}),
            ...(padTop    ? { paddingTop:    `${padTop}px` }    : {}),
            ...(padBottom ? { paddingBottom: `${padBottom}px` } : {}),
          }}>
            {inner}
          </div>
        ) : (
          <div key={`${section.id}-${idx}`}>{inner}</div>
        )
      })}
    </div>
  )
}
