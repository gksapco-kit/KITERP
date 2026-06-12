import { Button } from '../components/ui/button'
import { imgUrl } from '../lib/utils'
import {
  ArrowUpRight, ShoppingBag, Wrench, Truck, ShieldCheck, RefreshCw, Headphones,
} from 'lucide-react'
import type { HomeSectionTheme, HomeSectionVendor, SectionProps } from './types'
import {
  accentInText,
  editorialKitHero,
  fieldTypographyStyle,
  heroHeightClass,
  radiusClass,
  SectionNavLink,
  str,
} from './utils'
import {
  heroBannerDimOverlay,
  heroBrandGradient,
  heroPhotoOverlay,
  textOnSolid,
} from './heroContrast'
import { HeroBannerCarousel } from './HeroBannerCarousel'
import { resolveHeroBackgroundUrls } from './heroBanners'

export function HeroSection({
  props,
  theme,
  vendor,
  storePath,
  builderTemplateId,
  onPreviewNavigate,
  /** When false with `onPreviewNavigate`, CTAs look like links but do not change preview route (edit mode). */
  previewNavigateEnabled = true,
}: {
  props: SectionProps
  theme: HomeSectionTheme
  vendor: HomeSectionVendor
  storePath: (p: string) => string
  builderTemplateId?: string
  /** When set (vendor builder preview), avoids react-router navigation. */
  onPreviewNavigate?: (to: string) => void
  previewNavigateEnabled?: boolean
}) {
  const c = theme.colors
  const bgStyle = str(props.bg_style, theme.hero_style || 'gradient')
  const title = str(props.headline, theme.hero_title) || `Welcome to ${vendor?.display_name || 'Our Store'}`
  const subtitle = str(props.subtitle, theme.hero_subtitle) || vendor?.description || 'Quality products and services, delivered with care'
  const cta1 = str(props.cta_primary, 'Shop Now')
  const cta2 = str(props.cta_secondary, 'Our Services')
  const hh = heroHeightClass(theme.hero_height)
  const br = radiusClass(theme.button_radius)

  const heroBackgroundUrls = resolveHeroBackgroundUrls({
    explicitUrl: str(props.bg_image_url as string, ''),
    themeHeroUrl: theme.hero_image_url,
    vendor,
  })

  const kit = editorialKitHero(builderTemplateId, props)

  const editorialHeroFallback = heroBackgroundUrls[0]
    ? imgUrl(heroBackgroundUrls[0])
    : ''

  if (kit === 'atelier') {
    const kicker = str(props.editorial_kicker as string, 'Spring Edit · Vol 04')
    const h1 = str(props.headline, theme.hero_title) || 'Quiet objects for loud seasons.'
    const sub = str(props.subtitle, theme.hero_subtitle) || 'A small collection of garments and homewares, made by hand in studios we know by name.'
    const accent = str(props.accent_phrase as string, 'loud')
    const heroImg = editorialHeroFallback || '/storefront-ui/retail-hero.jpg'
    const useCarousel = heroBackgroundUrls.length > 1 && !str(props.bg_image_url as string, '') && !theme.hero_image_url
    return (
      <section className="bg-retail-bg text-retail-ink px-4 sm:px-6 lg:px-10 pt-7 sm:pt-10 pb-10 sm:pb-16 overflow-x-hidden">
        <div className="mx-auto max-w-7xl">
          {/*
            Fluid type + capped image: narrow split (xl) needs lower headline max and no break-words
            (avoids "objec | ts"). 6/6 columns balance copy vs photo; image keeps 4:3 cap on desktop.
          */}
          <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-12 xl:items-center xl:gap-x-6 2xl:gap-x-8">
            <div className="order-2 xl:order-1 xl:col-span-6 relative aspect-[4/3] max-h-[min(34dvh,200px)] w-full overflow-hidden rounded-2xl grain sm:aspect-[16/10] sm:max-h-[min(38dvh,260px)] md:max-h-[min(40dvh,300px)] sm:rounded-3xl xl:aspect-[4/3] xl:max-h-[min(48vh,420px)] xl:w-full">
              {useCarousel ? (
                <HeroBannerCarousel urls={heroBackgroundUrls} />
              ) : (
                <img src={heroImg} alt="" className="h-full w-full object-cover object-center" />
              )}
            </div>
            <div className="order-1 flex min-w-0 flex-col justify-between gap-6 xl:order-2 xl:col-span-6 xl:gap-8 xl:pl-1">
              <div className="min-w-0 space-y-4 sm:space-y-5">
                <p className="text-xs uppercase tracking-[0.18em] opacity-60 sm:text-xs sm:tracking-[0.2em]" style={fieldTypographyStyle(props, 'editorial_kicker')}>{kicker}</p>
                <h1
                  className="max-w-full hyphens-none text-balance break-normal font-display font-light tracking-[-0.02em] text-[clamp(0.78rem,min(2.05vw_+_0.26rem,0.34rem_+_3.6dvh),1.18rem)] sm:text-[clamp(0.8rem,min(2.2vw_+_0.28rem,0.36rem_+_3.85dvh),1.25rem)] md:text-[clamp(0.84rem,min(2.35vw_+_0.3rem,0.38rem_+_4dvh),1.38rem)] lg:text-[clamp(0.88rem,min(2.5vw_+_0.32rem,0.4rem_+_4.15dvh),1.52rem)] xl:text-[clamp(1.1rem,2.1vw_+_0.42rem,2.2rem)] 2xl:text-[clamp(1.15rem,2.25vw_+_0.45rem,2.45rem)] leading-[1.18] sm:leading-[1.12] md:leading-[1.08] xl:leading-[1.1] 2xl:leading-[1.06]"
                  style={fieldTypographyStyle(props, 'headline', { fluidMaxPx: true })}
                >
                  {accentInText(h1, accent, 'font-serif-it text-retail-accent not-italic text-[0.9em] sm:text-[0.98em] xl:text-[1em]')}
                </h1>
                <p className="max-w-xl text-[clamp(0.8rem,min(0.95rem_+_0.35vw,0.32rem_+_1.85dvh),1rem)] leading-relaxed opacity-80 text-pretty sm:text-[clamp(0.84rem,min(1rem_+_0.4vw,0.34rem_+_2dvh),1.0625rem)] md:text-[clamp(0.9rem,min(1.05rem_+_0.45vw,0.36rem_+_2.1dvh),1.125rem)] lg:text-[clamp(0.95rem,min(1.08rem_+_0.5vw,0.38rem_+_2.2dvh),1.1875rem)] xl:max-w-2xl xl:text-lg" style={fieldTypographyStyle(props, 'subtitle', { fluidMaxPx: true })}>{sub}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4 w-full sm:w-auto pt-1 xl:pt-0">
                <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/products')} className="bg-retail-ink text-retail-bg px-6 py-3 rounded-full text-sm sm:text-base inline-flex w-full sm:w-auto justify-center items-center gap-2 min-h-[44px] sm:min-h-[48px]" style={fieldTypographyStyle(props, 'cta_primary')}>
                  {str(props.cta_primary, 'Shop the edit')} <ArrowUpRight className="w-4 h-4 shrink-0" />
                </SectionNavLink>
                <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/blog')} className="border border-retail-ink/20 px-6 py-3 rounded-full text-sm sm:text-base inline-flex w-full sm:w-auto justify-center items-center min-h-[44px] sm:min-h-[48px]" style={fieldTypographyStyle(props, 'cta_secondary')}>
                  {str(props.cta_secondary, 'Lookbook')}
                </SectionNavLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (kit === 'verde') {
    const kicker = str(props.editorial_kicker as string, 'Est. 2024 · Brooklyn')
    const raw = str(props.headline, theme.hero_title) || 'Seasonal,\nquietly seasonal.'
    const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean)
    const accent = str(props.accent_phrase as string, 'seasonal')
    const heroImg = editorialHeroFallback || '/storefront-ui/restaurant-hero.jpg'
    const useCarousel = heroBackgroundUrls.length > 1 && !str(props.bg_image_url as string, '') && !theme.hero_image_url
    const line1 = lines[0] || 'Seasonal,'
    const line2 = lines.slice(1).join(' ') || 'quietly seasonal.'
    return (
      <section className="relative min-h-[min(38dvh,280px)] h-[min(58dvh,480px)] max-h-[min(90dvh,720px)] overflow-x-hidden bg-resto-bg sm:min-h-[360px] sm:h-[min(72dvh,620px)] sm:max-h-none md:h-[88vh] md:min-h-[520px] lg:min-h-[560px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          {useCarousel ? (
            <HeroBannerCarousel urls={heroBackgroundUrls} imageClassName="absolute inset-0 h-full w-full object-cover object-center opacity-70" />
          ) : (
            <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-resto-bg/40 via-transparent to-resto-bg" />
        </div>
        <div className="relative z-[1] h-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 flex flex-col justify-end py-10 sm:py-0 sm:pb-20 pb-14 min-h-0 min-w-0 w-full">
          <p className="text-xs sm:text-xs uppercase tracking-[0.22em] sm:tracking-[0.3em] text-resto-accent mb-3 sm:mb-6" style={fieldTypographyStyle(props, 'editorial_kicker')}>{kicker}</p>
          <h1
            className="font-display font-light text-[clamp(1rem,2.2vw_+_0.28rem,1.7rem)] sm:text-[clamp(1.2rem,2.9vw_+_0.35rem,2.1rem)] md:text-[clamp(1.5rem,3.8vw_+_0.38rem,2.95rem)] lg:text-[clamp(1.85rem,4.8vw_+_0.4rem,4rem)] leading-[1.12] sm:leading-[1.06] md:leading-[0.98] lg:leading-[0.88] tracking-tight max-w-full text-resto-ink break-normal hyphens-none flex flex-col gap-1.5 sm:gap-1"
            style={fieldTypographyStyle(props, 'headline', { fluidMaxPx: true })}
          >
            <span className="block min-w-0 max-sm:tracking-tight">{line1}</span>
            <span className="block min-w-0 max-sm:tracking-tight">{accentInText(line2, accent, 'font-serif-it text-resto-accent not-italic text-[0.88em] sm:text-[1em]')}</span>
          </h1>
          <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto sm:flex-wrap">
            <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/services')} className="bg-resto-accent text-resto-bg px-6 py-3 rounded-full text-sm inline-flex w-full sm:w-auto justify-center items-center" style={fieldTypographyStyle(props, 'cta_primary')}>
              {str(props.cta_primary, 'Reserve a table')}
            </SectionNavLink>
            <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/products')} className="border border-resto-ink/30 px-6 py-3 rounded-full text-sm text-resto-ink inline-flex w-full sm:w-auto justify-center items-center" style={fieldTypographyStyle(props, 'cta_secondary')}>
              {str(props.cta_secondary, "View tonight's menu")}
            </SectionNavLink>
          </div>
        </div>
      </section>
    )
  }

  if (kit === 'solace') {
    const kicker = str(props.editorial_kicker as string, 'Independent care · since 1998')
    const raw = str(props.headline, theme.hero_title) || 'Quiet rooms.\nPatient hands.\nModern medicine.'
    const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean)
    const accent = str(props.accent_phrase as string, 'Patient')
    const sub = str(props.subtitle, theme.hero_subtitle) || 'A 90-bed independent hospital built around the unhurried appointment. Same-day bookings across 14 specialties.'
    const heroImg = editorialHeroFallback || '/storefront-ui/hospital-hero.jpg'
    const useCarousel = heroBackgroundUrls.length > 1 && !str(props.bg_image_url as string, '') && !theme.hero_image_url
    const lineTail = lines[2] || lines.slice(2).join(' ')

    return (
      <section className="bg-hosp-bg text-hosp-ink px-4 sm:px-6 lg:px-10 pt-7 sm:pt-10 pb-10 sm:pb-16 overflow-x-hidden">
        <div className="mx-auto max-w-7xl">
          {/*
            Desktop: 50/50 columns, vertically centered pair — image uses a capped 4:3 frame (no tall 4:5 portrait)
            so headline, body, and photo feel scaled together. Mobile: stacked with bounded image height.
          */}
          <div className="grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-12 xl:items-center xl:gap-x-6 2xl:gap-x-8">
            <div className="order-1 flex min-w-0 flex-col gap-6 sm:gap-7 xl:order-1 xl:col-span-6 xl:gap-8 xl:pr-2">
              <div className="min-w-0 space-y-4 sm:space-y-5">
                <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.26em] text-hosp-accent font-medium" style={fieldTypographyStyle(props, 'editorial_kicker')}>{kicker}</p>
                <h1
                  className="flex max-w-full flex-col gap-1.5 sm:gap-1 hyphens-none text-balance break-normal font-display font-light tracking-tight text-[clamp(1.08rem,2.85vw_+_0.38rem,1.85rem)] sm:text-[clamp(1.28rem,3.15vw_+_0.42rem,2.25rem)] md:text-[clamp(1.48rem,3.55vw_+_0.44rem,2.95rem)] lg:text-[clamp(1.62rem,3.85vw_+_0.44rem,3.45rem)] xl:text-[clamp(1.65rem,3.25vw_+_0.5rem,3.35rem)] 2xl:text-[clamp(1.85rem,3.6vw_+_0.48rem,3.75rem)] leading-[1.12] sm:leading-[1.06] md:leading-[1.02] xl:leading-[1.03] 2xl:leading-[1.02]"
                  style={fieldTypographyStyle(props, 'headline', { fluidMaxPx: true })}
                >
                  {lines[0] ? <span className="block min-w-0 max-sm:tracking-tight">{lines[0]}</span> : null}
                  {lines[1] ? (
                    <span className="block min-w-0 max-sm:tracking-tight">{accentInText(lines[1], accent, 'font-serif-it text-hosp-accent not-italic text-[0.94em] sm:text-[1.04em]')}</span>
                  ) : null}
                  {lineTail ? <span className="block min-w-0 max-sm:tracking-tight">{lineTail}</span> : null}
                </h1>
                <p className="max-w-xl text-base leading-relaxed opacity-85 text-pretty sm:text-lg md:text-xl xl:max-w-2xl font-serif" style={fieldTypographyStyle(props, 'subtitle', { fluidMaxPx: true })}>{sub}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto sm:flex-wrap pt-1">
                <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/services')} className="bg-hosp-accent text-hosp-bg px-7 py-3.5 rounded-full text-base sm:text-lg font-medium inline-flex w-full sm:w-auto justify-center items-center min-h-[48px] sm:min-h-[52px]" style={fieldTypographyStyle(props, 'cta_primary')}>
                  {str(props.cta_primary, 'Book an appointment')}
                </SectionNavLink>
                <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/services')} className="border border-hosp-ink/20 px-7 py-3.5 rounded-full text-base sm:text-lg font-medium inline-flex w-full sm:w-auto justify-center items-center min-h-[48px] sm:min-h-[52px]" style={fieldTypographyStyle(props, 'cta_secondary')}>
                  {str(props.cta_secondary, 'Browse services')}
                </SectionNavLink>
              </div>
            </div>
            <div className="order-2 relative aspect-[4/3] max-h-[min(38dvh,220px)] w-full overflow-hidden rounded-2xl grain sm:aspect-[16/10] sm:max-h-[min(42dvh,280px)] md:max-h-[min(44dvh,320px)] sm:rounded-3xl xl:order-2 xl:col-span-6 xl:aspect-[4/3] xl:max-h-[min(52vh,480px)] xl:mx-auto xl:w-full">
              {useCarousel ? (
                <HeroBannerCarousel urls={heroBackgroundUrls} />
              ) : (
                <img src={heroImg} alt="" className="h-full w-full object-cover object-center" />
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (bgStyle === 'minimal') {
    return (
      <section className="bg-white border-b">
        <div className={`max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 ${hh} text-center`}>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900" style={{ fontFamily: theme.font, ...fieldTypographyStyle(props, 'headline') }}>{title}</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto" style={fieldTypographyStyle(props, 'subtitle')}>{subtitle}</p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/products')}>
              <Button size="lg" className={`font-bold gap-2 h-12 px-8 ${br}`} style={{ backgroundColor: c.primary, color: textOnSolid(c.primary), ...fieldTypographyStyle(props, 'cta_primary') }}><ShoppingBag className="w-5 h-5" /> {cta1}</Button>
            </SectionNavLink>
            <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/services')}>
              <Button size="lg" variant="outline" className={`gap-2 h-12 px-8 ${br}`} style={{ borderColor: c.primary, color: c.primary, ...fieldTypographyStyle(props, 'cta_secondary') }}><Wrench className="w-5 h-5" /> {cta2}</Button>
            </SectionNavLink>
          </div>
        </div>
      </section>
    )
  }

  if (bgStyle === 'dark') {
    return (
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0a1e, #1e1b4b)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 30% 50%, ${c.primary}60, transparent 60%), radial-gradient(circle at 70% 20%, ${c.accent}40, transparent 50%)` }} />
        <div className={`relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 ${hh} text-center`}>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight" style={{ fontFamily: theme.font, ...fieldTypographyStyle(props, 'headline') }}>{title}</h1>
          <p className="mt-5 text-xl text-gray-300 max-w-2xl mx-auto" style={fieldTypographyStyle(props, 'subtitle')}>{subtitle}</p>
          <div className="mt-10 flex justify-center gap-4 flex-wrap">
            <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/products')}>
              <Button size="lg" className={`font-bold gap-2 h-14 px-10 ${br}`} style={{ backgroundColor: c.accent, color: textOnSolid(c.accent), ...fieldTypographyStyle(props, 'cta_primary') }}><ShoppingBag className="w-5 h-5" /> {cta1}</Button>
            </SectionNavLink>
            <SectionNavLink onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/services')}>
              <Button size="lg" variant="outline" className={`border-white/30 text-white hover:bg-white/10 gap-2 h-14 px-10 ${br}`} style={fieldTypographyStyle(props, 'cta_secondary')}>{cta2}</Button>
            </SectionNavLink>
          </div>
        </div>
      </section>
    )
  }

  if (bgStyle === 'image') {
    const minHeightClass =
      theme.hero_height === 'compact'
        ? 'min-h-[min(36dvh,200px)] sm:min-h-[240px] md:min-h-[280px]'
        : theme.hero_height === 'tall'
          ? 'min-h-[min(44dvh,280px)] sm:min-h-[400px] md:min-h-[520px] lg:min-h-[600px]'
          : 'min-h-[min(40dvh,240px)] sm:min-h-[320px] md:min-h-[420px]'
    const bgUrl = heroBackgroundUrls[0] ?? ''
    const primaryBtnBg = c.primary
    const primaryBtnFg = textOnSolid(primaryBtnBg)
    return (
      <section className={`relative overflow-hidden ${minHeightClass} flex items-center`}>
        {bgUrl ? (
          <>
            <HeroBannerCarousel urls={heroBackgroundUrls} />
            <div className="absolute inset-0" style={{ background: heroPhotoOverlay(c.primary, c.secondary) }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: heroBrandGradient(c.primary, c.secondary) }} />
        )}
        <div className={`relative z-[1] w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 ${hh} text-center`}>
          <div className="max-w-2xl w-full mx-auto flex flex-col items-center text-center">
            <h1
              className="w-full text-center text-2xl sm:text-4xl font-bold leading-tight text-white drop-shadow-sm text-balance"
              style={{ fontFamily: theme.font, ...fieldTypographyStyle(props, 'headline') }}
            >
              {title}
            </h1>
            <p
              className="w-full text-center mt-4 text-lg text-white/95 max-w-xl mx-auto drop-shadow-sm text-pretty"
              style={fieldTypographyStyle(props, 'subtitle')}
            >
              {subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 w-full">
              <SectionNavLink
                className="inline-flex"
                onPreviewNavigate={onPreviewNavigate}
                previewNavigateEnabled={previewNavigateEnabled}
                to={storePath('/products')}
              >
              <Button
                size="lg"
                className={`font-bold gap-2 h-12 px-8 border-0 shadow-md ${br}`}
                style={{ backgroundColor: primaryBtnBg, color: primaryBtnFg, ...fieldTypographyStyle(props, 'cta_primary') }}
              >
                <ShoppingBag className="w-5 h-5" /> {cta1}
              </Button>
            </SectionNavLink>
            <SectionNavLink
              className="inline-flex"
              onPreviewNavigate={onPreviewNavigate}
              previewNavigateEnabled={previewNavigateEnabled}
              to={storePath('/services')}
            >
              <Button
                size="lg"
                variant="outline"
                className={`gap-2 h-12 px-8 bg-white/10 backdrop-blur-sm border-2 hover:bg-white/20 ${br}`}
                style={{ borderColor: 'rgba(255,255,255,0.75)', color: '#ffffff', ...fieldTypographyStyle(props, 'cta_secondary') }}
              >
                <Wrench className="w-5 h-5" /> {cta2}
              </Button>
            </SectionNavLink>
          </div>
          </div>
        </div>
      </section>
    )
  }

  const bgUrl = heroBackgroundUrls[0] ?? ''
  const accentBtnFg = textOnSolid(c.accent)
  return (
    <section className="relative overflow-hidden" style={{ background: heroBrandGradient(c.primary, c.secondary) }}>
      {bgUrl && (
        <div className="absolute inset-0">
          <HeroBannerCarousel urls={heroBackgroundUrls} />
          <div className="absolute inset-0" style={{ background: heroBannerDimOverlay(c.primary, c.secondary) }} />
        </div>
      )}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='1.5' fill='rgba(255,255,255,0.5)'/%3E%3C/svg%3E\")" }} />
      <div className={`relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 ${hh} text-center`}>
        <div className="max-w-2xl w-full mx-auto flex flex-col items-center text-center">
          <h1 className="w-full text-center text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight text-balance" style={{ fontFamily: theme.font, ...fieldTypographyStyle(props, 'headline') }}>{title}</h1>
          <p className="w-full text-center mt-4 text-lg text-white/95 max-w-lg mx-auto text-pretty" style={fieldTypographyStyle(props, 'subtitle')}>{subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 w-full">
            <SectionNavLink className="inline-flex" onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/products')}>
              <Button
                size="lg"
                className={`font-bold gap-2 h-12 px-8 border-0 shadow-md ${br}`}
                style={{ backgroundColor: c.accent, color: accentBtnFg, ...fieldTypographyStyle(props, 'cta_primary') }}
              >
                <ShoppingBag className="w-5 h-5" /> {cta1}
              </Button>
            </SectionNavLink>
            <SectionNavLink className="inline-flex" onPreviewNavigate={onPreviewNavigate} previewNavigateEnabled={previewNavigateEnabled} to={storePath('/services')}>
              <Button
                size="lg"
                variant="outline"
                className={`border-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 gap-2 h-12 px-8 ${br}`}
                style={{ borderColor: 'rgba(255,255,255,0.75)', color: '#ffffff', ...fieldTypographyStyle(props, 'cta_secondary') }}
              >
                <Wrench className="w-5 h-5" /> {cta2}
              </Button>
            </SectionNavLink>
          </div>
        </div>
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto mt-12">
            {[
              { icon: Truck, title: 'Fast Delivery', desc: 'Quick & reliable' },
              { icon: ShieldCheck, title: 'Secure Shopping', desc: 'Safe platform' },
              { icon: RefreshCw, title: 'Easy Returns', desc: 'Hassle-free' },
              { icon: Headphones, title: '24/7 Support', desc: 'Always here' },
            ].map((f) => (
              <div key={f.title} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border-2 border-white/25 shadow-sm">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-3 bg-white/15">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white text-base font-semibold">{f.title}</h3>
                <p className="text-white/90 text-sm mt-1">{f.desc}</p>
              </div>
            ))}
        </div>
      </div>
    </section>
  )
}
