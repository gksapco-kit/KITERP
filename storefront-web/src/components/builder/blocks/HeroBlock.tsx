import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { imgUrl } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { sanitizeWellnessBodyCopy, sanitizeWellnessCtaLabel } from '@/lib/wellnessTemplateCopy'
import {
  heroShouldUseFullBleedImage,
  heroUsesBackgroundImage,
  heroUsesSideImage,
  resolveGradientCss,
} from '@/lib/heroLayoutUtils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
}

function borderRadiusPx(style: StyleConfig): number {
  const br = style.border_radius as string | undefined
  if (br === 'none' || br === 'sharp') return 0
  if (br === 'sm') return 4
  if (br === 'lg') return 16
  return 8
}

export default function HeroBlock({ site, style, props, blockType }: Props) {
  const { storePath } = useVendor()

  const headline = sanitizeWellnessBodyCopy((props.headline as string) || site.name || 'Welcome')
  const headlineLine2 = sanitizeWellnessBodyCopy((props.headline_line2 as string) || '')
  const eyebrow = sanitizeWellnessBodyCopy((props.eyebrow as string) || '')
  const eyebrowPlain = props.eyebrow_plain === true
  const subtitle = sanitizeWellnessBodyCopy((props.subtitle as string) || site.description || '')
  const ctaPrimary = sanitizeWellnessBodyCopy((props.cta_primary as string) || 'Get Started')
  const ctaSecondaryRaw = (props.cta_secondary as string | null) || null
  const ctaSecondary = ctaSecondaryRaw ? sanitizeWellnessCtaLabel(ctaSecondaryRaw) : null
  const ctaUrl = (props.cta_primary_url as string) || (props.cta_url as string) || '/products'
  const ctaSecUrl = (props.cta_secondary_url as string) || '/about'
  const bgStyle = (props.bg_style as string) || 'gradient'
  const layout = (props.layout as string) || 'centered'

  const isSplit = heroUsesSideImage(blockType, props)
  const isMinimal = blockType === 'hero_minimal' || bgStyle === 'minimal'

  const gradientFrom = props.gradient_from as string | undefined
  const gradientTo = props.gradient_to as string | undefined
  const gradientDir = (props.gradient_dir as string) || '135deg'
  const gradientPreset = props.gradient_preset as string | undefined
  const heroGrad =
    gradientFrom && gradientTo
      ? `linear-gradient(${gradientDir}, ${gradientFrom}, ${gradientTo})`
      : resolveGradientCss(gradientPreset, style.primary_color, style.secondary_color || style.primary_color)

  const wantsBgImage = heroUsesBackgroundImage(blockType, props)
  const heroImageRaw = wantsBgImage
    ? ((props.bg_image_url as string | undefined)
      || (bgStyle === 'image' ? (props.image_url as string | undefined) : undefined))
    : undefined
  const sideImageRaw = isSplit
    ? ((props.image_url as string | undefined) || (props.bg_image_url as string | undefined))
    : undefined
  const heroImageUrl = heroImageRaw ? imgUrl(heroImageRaw) : undefined
  const sideImageUrl = sideImageRaw ? imgUrl(sideImageRaw) : undefined

  const hasSideImage = isSplit && !!sideImageUrl
  const hasBgImg = !!heroImageUrl
  const heroUsesImageBg = heroShouldUseFullBleedImage(blockType, props, hasBgImg)
  const splitSideBySide = isSplit && hasSideImage && !heroUsesImageBg

  const heroBg = heroUsesImageBg
    ? undefined
    : hasSideImage
      ? style.surface_color || style.bg_color || '#ffffff'
      : bgStyle === 'gradient'
        ? heroGrad
        : bgStyle === 'dark'
          ? '#111827'
          : bgStyle === 'solid'
            ? ((props.bg_color as string) || '#0f172a')
            : bgStyle === 'image'
              ? undefined
              : isMinimal
                ? ((props.bg_color as string) || style.bg_color)
                : `linear-gradient(135deg, ${style.bg_color}, ${style.surface_color})`

  const heroBgImage = heroUsesImageBg ? `url(${heroImageUrl})` : undefined
  const isDark =
    heroUsesImageBg ||
    bgStyle === 'gradient' ||
    bgStyle === 'dark' ||
    bgStyle === 'image' ||
    (bgStyle === 'solid' && !isMinimal)
  const heroText = isDark && !splitSideBySide ? '#fff' : style.text_color
  const heroSubText = isDark && !splitSideBySide ? 'rgba(255,255,255,0.82)' : `${style.text_color}cc`

  const squareCta = props.cta_square === true || style.border_radius === 'sharp' || style.border_radius === 'none'
  const ctaRadius = squareCta ? 0 : borderRadiusPx(style)
  const ctaPadClass = squareCta ? 'px-7 h-12 inline-flex items-center' : 'px-6 py-3'

  const hasFashionHeadline = !!headlineLine2 || eyebrowPlain

  const renderEyebrow = () => {
    if (!eyebrow && !eyebrowPlain) return null
    if (eyebrowPlain) {
      return (
        <span
          className="text-xs uppercase tracking-[0.3em] opacity-70 mb-2 block"
          style={{ color: splitSideBySide ? style.text_color : heroText }}
        >
          {eyebrow}
        </span>
      )
    }
    return (
      <span
        className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-2"
        style={{
          backgroundColor: isDark && !splitSideBySide ? 'rgba(255,255,255,0.15)' : `${style.accent_color}22`,
          color: isDark && !splitSideBySide ? '#fff' : style.accent_color,
        }}
      >
        {eyebrow}
      </span>
    )
  }

  const renderHeadline = () => {
    if (headlineLine2 || (isSplit && hasFashionHeadline)) {
      return (
        <h1
          className={
            isSplit
              ? hasFashionHeadline
                ? 'font-semibold leading-[0.95] text-balance text-[clamp(1.65rem,4vw_+_0.45rem,2.65rem)] sm:text-[clamp(2rem,4.5vw_+_0.45rem,3.25rem)] lg:text-[clamp(2.35rem,5vw_+_0.5rem,3.75rem)] mb-5'
                : 'text-4xl sm:text-5xl md:text-6xl font-semibold leading-[0.95] mb-5'
              : 'text-3xl font-extrabold leading-tight mb-5'
          }
          style={{ fontFamily: style.font_heading, color: heroText }}
        >
          <span className="block font-semibold">{headline}</span>
          {headlineLine2 ? (
            <>
              <br />
              <em
                className="font-normal not-italic"
                style={{
                  fontStyle: 'italic',
                  color: isDark && !splitSideBySide ? 'rgba(255,255,255,0.95)' : style.accent_color,
                }}
              >
                {headlineLine2}
              </em>
            </>
          ) : null}
        </h1>
      )
    }
    return (
      <h1
        className={
          isSplit
            ? 'text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-5'
            : 'text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-5'
        }
        style={{ fontFamily: style.font_heading, color: heroText }}
      >
        {headline}
      </h1>
    )
  }

  const renderCtas = (centered = false) => (
    <div className={`flex gap-3 flex-wrap pt-1 items-start ${centered ? 'justify-center' : ''}`}>
      {ctaPrimary && (
        <Link
          to={storePath(ctaUrl)}
          className={`font-bold text-sm shadow-lg hover:opacity-90 transition-opacity ${ctaPadClass}`}
          style={{
            backgroundColor: isDark && !splitSideBySide ? '#fff' : style.primary_color,
            color: isDark && !splitSideBySide ? style.primary_color : '#fff',
            borderRadius: ctaRadius,
          }}
        >
          {ctaPrimary}
          {hasFashionHeadline && splitSideBySide ? <ArrowRight className="ml-2 h-4 w-4 inline" /> : null}
        </Link>
      )}
      {ctaSecondary && ctaSecondary !== ctaPrimary && (
        <Link
          to={storePath(ctaSecUrl)}
          className={`font-semibold text-sm bg-transparent hover:opacity-80 transition-opacity ${ctaPadClass}`}
          style={{
            border: `2px solid ${isDark && !splitSideBySide ? 'rgba(255,255,255,0.5)' : `${style.text_color}99`}`,
            color: heroText,
            borderRadius: ctaRadius,
          }}
        >
          {ctaSecondary}
        </Link>
      )}
    </div>
  )

  const renderSideImage = () => {
    if (!isSplit) return null
    return (
      <div
        className={
          splitSideBySide
            ? 'relative z-10 w-full md:w-1/2 min-h-[420px] md:min-h-[640px]'
            : 'relative z-10 w-full flex-1 md:w-auto'
        }
        style={splitSideBySide ? { backgroundColor: style.surface_color || '#f3f4f6' } : undefined}
      >
        {sideImageUrl ? (
          <img
            src={sideImageUrl}
            alt=""
            className={
              splitSideBySide
                ? 'absolute inset-0 h-full w-full min-h-[420px] md:min-h-[640px] object-cover'
                : 'w-full object-cover shadow-2xl rounded-2xl'
            }
            style={
              splitSideBySide
                ? undefined
                : { maxHeight: '640px', minHeight: hasSideImage ? '260px' : '220px' }
            }
            loading="lazy"
          />
        ) : (
          <div
            className={
              splitSideBySide
                ? 'absolute inset-0 min-h-[420px] md:min-h-[640px] flex items-center justify-center'
                : 'w-full h-56 flex items-center justify-center rounded-2xl'
            }
            style={{
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
              border: isDark ? '2px dashed rgba(255,255,255,0.3)' : '2px dashed rgba(0,0,0,0.12)',
            }}
          >
            <span className={`text-sm font-medium ${isDark ? 'text-white/50' : 'text-gray-400'}`}>Hero Image</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <section
      className={
        splitSideBySide
          ? 'relative overflow-hidden flex flex-col md:flex-row md:items-stretch'
          : isSplit
            ? 'relative px-8 flex flex-col md:flex-row items-center gap-10 py-16'
            : 'relative px-8 py-24'
      }
      style={
        splitSideBySide
          ? { color: heroText, borderBottom: `1px solid ${style.text_color}18` }
          : {
              background: heroBg,
              backgroundImage: heroBgImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: heroText,
            }
      }
    >
      {heroUsesImageBg && bgStyle === 'gradient' && (
        <div className="absolute inset-0 z-0" style={{ background: heroGrad, opacity: props.overlay === false ? 0.55 : 0.82 }} />
      )}
      {heroUsesImageBg && bgStyle === 'image' && props.overlay !== false && (
        <div className="absolute inset-0 bg-black/45 z-0" />
      )}

      <div
        className={
          splitSideBySide
            ? 'space-y-5 relative z-10 flex-1 md:w-1/2 px-6 sm:px-12 py-16 lg:py-28 flex flex-col justify-center max-w-xl md:max-w-none'
            : isSplit
              ? 'space-y-5 relative z-10 flex-1 max-w-xl'
              : 'space-y-5 relative z-10 text-center max-w-3xl mx-auto'
        }
        style={
          splitSideBySide
            ? { backgroundColor: style.surface_color || style.bg_color || '#ffffff', zIndex: 1 }
            : { zIndex: 1 }
        }
      >
        {renderEyebrow()}
        {renderHeadline()}
        {subtitle && subtitle !== headline && (
          <p
            className={`text-base leading-relaxed max-w-lg text-pretty ${isSplit && !isDark ? 'opacity-80' : ''}`}
            style={{ color: heroSubText, margin: isSplit ? undefined : '0 auto' }}
          >
            {subtitle}
          </p>
        )}
        {renderCtas(!isSplit)}
      </div>

      {renderSideImage()}
    </section>
  )
}
