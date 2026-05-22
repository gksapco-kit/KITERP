import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
}

export default function HeroBlock({ site, style, props, blockType }: Props) {
  const { storePath } = useVendor()

  const headline = (props.headline as string) || site.name || 'Welcome'
  const headlineLine2 = (props.headline_line2 as string) || ''
  const eyebrow = (props.eyebrow as string) || ''
  const eyebrowPlain = props.eyebrow_plain === true
  const subtitle = (props.subtitle as string) || site.description || ''
  const ctaPrimary = (props.cta_primary as string) || 'Get Started'
  const ctaSecondary = (props.cta_secondary as string | null) || null
  const ctaUrl = (props.cta_primary_url as string) || (props.cta_url as string) || '/products'
  const ctaSecUrl = (props.cta_secondary_url as string) || '/about'
  const imageUrl = (props.image_url as string | null) || null
  const bgStyle = (props.bg_style as string) || 'gradient'
  const layout = (props.layout as string) || 'centered'
  const ctaSquare = props.cta_square === true || style.border_radius === 'sharp' || (style.border_radius as string) === 'none'

  const isSplit = blockType === 'hero_split' || layout === 'split'
  const isMinimal = blockType === 'hero_minimal' || layout === 'minimal'
  const hasFashionHeadline = !!headlineLine2 || eyebrowPlain

  const btnPrimaryCls = ctaSquare
    ? 'inline-flex items-center px-7 h-12 text-sm font-bold rounded-none hover:opacity-90 transition-opacity'
    : 'inline-flex items-center px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity'
  const btnSecondaryCls = ctaSquare
    ? 'inline-flex items-center px-7 h-12 text-sm font-semibold rounded-none border-2 bg-transparent hover:opacity-80 transition-opacity'
    : 'inline-flex items-center px-6 py-3 rounded-xl text-sm font-semibold border-2 bg-transparent hover:bg-gray-50 transition-opacity'

  let bgClass = 'bg-gradient-to-br from-primary to-emerald-800'
  let textClass = 'text-white'
  if (bgStyle === 'minimal' || isMinimal) {
    bgClass = 'bg-white'
    textClass = 'text-gray-900'
  } else if (bgStyle === 'image' && imageUrl && !isSplit) {
    bgClass = ''
  }

  /** Atelier-style split: full-height image column, editorial type scale */
  if (isSplit && imageUrl && bgStyle === 'minimal') {
    const leftBg = style.surface_color || style.bg_color || '#ffffff'
    return (
      <section className="relative overflow-hidden border-b" style={{ borderColor: `${style.text_color}18`, color: style.text_color }}>
        <div className="grid grid-cols-1 xl:grid-cols-2">
          <div
            className="flex max-w-xl flex-col justify-center px-6 py-16 sm:px-12 xl:max-w-none xl:py-28"
            style={{ backgroundColor: leftBg, fontFamily: style.font_body }}
          >
            {(eyebrow || eyebrowPlain) && (
              <span
                className={
                  eyebrowPlain
                    ? 'text-xs uppercase tracking-[0.3em] opacity-70 mb-6 block'
                    : 'text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-4'
                }
                style={
                  eyebrowPlain
                    ? { color: style.text_color }
                    : { backgroundColor: `${style.accent_color}22`, color: style.accent_color }
                }
              >
                {eyebrow}
              </span>
            )}
            {hasFashionHeadline ? (
              <h1
                className="font-semibold leading-[0.95] text-balance text-[clamp(1.65rem,4vw_+_0.45rem,2.65rem)] sm:text-[clamp(2rem,4.5vw_+_0.45rem,3.25rem)] lg:text-[clamp(2.35rem,5vw_+_0.5rem,3.75rem)] mb-6"
                style={{ fontFamily: style.font_heading, color: style.text_color }}
              >
                <span className="block font-semibold">{headline}</span>
                {headlineLine2 ? (
                  <>
                    <br />
                    <em className="font-normal not-italic" style={{ fontStyle: 'italic', color: style.accent_color }}>
                      {headlineLine2}
                    </em>
                  </>
                ) : null}
              </h1>
            ) : (
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6"
                style={{ fontFamily: style.font_heading, color: style.text_color }}
              >
                {headline}
              </h1>
            )}
            {subtitle && <p className="text-base opacity-80 mb-8 max-w-md text-pretty leading-relaxed">{subtitle}</p>}
            <div className="flex flex-wrap gap-3">
              <Link
                to={storePath(ctaUrl)}
                className={btnPrimaryCls}
                style={{ backgroundColor: style.primary_color, color: '#fff' }}
              >
                {ctaPrimary}
                {hasFashionHeadline ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Link>
              {ctaSecondary && (
                <Link
                  to={storePath(ctaSecUrl)}
                  className={btnSecondaryCls}
                  style={{ borderColor: `${style.text_color}99`, color: style.text_color }}
                >
                  {ctaSecondary}
                </Link>
              )}
            </div>
          </div>
          <div
            className="relative h-[min(44dvh,320px)] w-full min-h-[260px] sm:h-[min(50dvh,480px)] sm:min-h-[360px] md:h-[min(56dvh,560px)] md:min-h-[400px] xl:h-auto xl:min-h-[640px]"
            style={{ backgroundColor: style.surface_color || '#f3f4f6' }}
          >
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" loading="lazy" />
          </div>
        </div>
      </section>
    )
  }

  if (isSplit) {
    return (
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-6">{headline}</h1>
            {subtitle && <p className="text-lg text-gray-600 mb-8">{subtitle}</p>}
            <div className="flex flex-wrap gap-4">
              <Link to={storePath(ctaUrl)} className="px-6 py-3 rounded-xl text-white font-semibold hover:opacity-90 transition-all" style={{ backgroundColor: style.primary_color }}>{ctaPrimary}</Link>
              {ctaSecondary && <Link to={storePath(ctaSecUrl)} className="px-6 py-3 rounded-xl border-2 font-semibold hover:bg-gray-50 transition-all" style={{ borderColor: style.primary_color, color: style.primary_color }}>{ctaSecondary}</Link>}
            </div>
          </div>
          <div className="relative">
            {imageUrl ? (
              <img src={imageUrl} alt={headline} className="aspect-video max-h-[min(48dvh,280px)] w-full rounded-2xl object-cover object-center shadow-2xl sm:max-h-none" loading="lazy" />
            ) : (
              <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-accent to-primary/25 flex items-center justify-center">
                <span className="text-primary/70 text-lg font-medium">Hero Image</span>
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  const sectionStyle = bgStyle === 'image' && imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {}

  return (
    <section className={`${bgClass} relative`} style={sectionStyle}>
      {bgStyle === 'image' && imageUrl && <div className="absolute inset-0 bg-black/50" />}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 lg:py-32 text-center">
        <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6 ${textClass}`} style={{ fontFamily: style.font_heading }}>{headline}</h1>
        {subtitle && <p className={`text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed ${isMinimal ? 'text-gray-600' : 'text-white/90'}`}>{subtitle}</p>}
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to={storePath(ctaUrl)}
            className={`px-8 py-4 rounded-xl font-semibold text-base transition-all hover:scale-105 ${isMinimal ? 'text-white hover:opacity-90' : 'bg-white hover:bg-gray-50'}`}
            style={isMinimal ? { backgroundColor: style.primary_color } : { color: style.primary_color }}
          >
            {ctaPrimary}
          </Link>
          {ctaSecondary && (
            <Link
              to={storePath(ctaSecUrl)}
              className={`px-8 py-4 rounded-xl font-semibold text-base transition-all border-2 ${isMinimal ? 'hover:bg-gray-50' : 'border-white/40 text-white hover:bg-white/10'}`}
              style={isMinimal ? { borderColor: style.primary_color, color: style.primary_color } : {}}
            >
              {ctaSecondary}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
