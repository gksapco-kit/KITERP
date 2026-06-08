import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { sanitizeWellnessBodyCopy, sanitizeWellnessCtaLabel } from '@/lib/wellnessTemplateCopy'
import {
  heroShouldUseFullBleedImage,
  heroUsesBackgroundImage,
  heroUsesSideImage,
  resolveGradientCss,
} from '@/lib/heroLayoutUtils'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderCtaButton } from '@/components/builder/BuilderCtaButton'
import { BuilderContentGroup } from '@/components/builder/BuilderContentGroup'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
  blockId?: string
}

function borderRadiusPx(style: StyleConfig): number {
  const br = style.border_radius as string | undefined
  if (br === 'none' || br === 'sharp') return 0
  if (br === 'sm') return 4
  if (br === 'lg') return 16
  return 8
}

export default function HeroBlock({ site, style, props, blockType, blockId }: Props) {
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
  const layout = (props.layout as string) || (blockType === 'hero_split' ? 'split' : 'centered')
  const layoutMode = layout
  const imageOnLeft = String(props.image_position ?? 'right') === 'left'
  const wideImage = String(props.image_width ?? '') === '60'
  const showDivider = props.show_divider === true
  const mediaClip = props.media_clip
  const clippedMedia = hasMediaClip(mediaClip)

  const isSplit = heroUsesSideImage(blockType, props)
  const isStacked = isSplit && layoutMode === 'stacked'
  const isOverlap = isSplit && layoutMode === 'overlap'
  const isSplitPanel = isSplit && layoutMode === 'split' && !isStacked && !isOverlap
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
  /** True 50/50 split — matches layout picker (always for hero_split split layout). */
  const splitSideBySide = isSplitPanel

  const splitTextPanelStyle = (): CSSProperties => {
    if (bgStyle === 'solid') {
      return { backgroundColor: (props.bg_color as string) || '#0f172a' }
    }
    if (bgStyle === 'gradient') {
      return { background: heroGrad }
    }
    if (props.bg_color) {
      return { backgroundColor: props.bg_color as string }
    }
    return { backgroundColor: style.surface_color || style.bg_color || '#ffffff' }
  }

  const splitPanelIsDark =
    bgStyle === 'solid' || bgStyle === 'gradient' || bgStyle === 'dark'

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
    (bgStyle === 'solid' && !isMinimal && !isSplitPanel)
  const panelUsesDarkText = isOverlap
    ? false
    : (isSplitPanel || isStacked)
      ? splitPanelIsDark
      : isDark && !splitSideBySide
  const heroText = panelUsesDarkText ? '#fff' : style.text_color
  const heroSubText = panelUsesDarkText ? 'rgba(255,255,255,0.82)' : `${style.text_color}cc`

  const textPanelWidth = wideImage ? 'md:w-[40%]' : 'md:w-1/2'
  const imagePanelWidth = wideImage ? 'md:w-[60%]' : 'md:w-1/2'

  const squareCta = props.cta_square === true || style.border_radius === 'sharp' || style.border_radius === 'none'
  const ctaRadius = squareCta ? 0 : borderRadiusPx(style)
  const ctaPadClass = squareCta ? 'px-7 h-12 inline-flex items-center' : 'px-6 py-3'

  const hasFashionHeadline = !!headlineLine2 || eyebrowPlain

  const renderEyebrow = () => {
    if (!eyebrow && !eyebrowPlain) return null
    if (eyebrowPlain) {
      return (
        <BuilderTextField
          blockId={blockId}
          blockProps={props}
          fieldKey="eyebrow"
          as="span"
          value={eyebrow}
          className="text-xs uppercase tracking-[0.3em] opacity-70 mb-2 block"
          style={{ color: heroText }}
        />
      )
    }
    return (
      <BuilderTextField
        blockId={blockId}
        blockProps={props}
        fieldKey="eyebrow"
        as="span"
        value={eyebrow}
        className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-2"
        style={{
          backgroundColor: panelUsesDarkText ? 'rgba(255,255,255,0.15)' : `${style.accent_color}22`,
          color: panelUsesDarkText ? '#fff' : style.accent_color,
        }}
      />
    )
  }

  const renderHeadline = () => {
    const headlineBaseStyle = {
      fontFamily: style.font_heading,
      color: heroText,
    }
    const line2BaseStyle = {
      fontStyle: 'italic' as const,
      color: panelUsesDarkText ? 'rgba(255,255,255,0.95)' : style.accent_color,
    }

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
        >
          <BuilderTextField
            blockId={blockId}
            blockProps={props}
            fieldKey="headline"
            as="span"
            value={headline}
            className="block font-semibold"
            style={headlineBaseStyle}
          />
          {headlineLine2 ? (
            <>
              <br />
              <BuilderTextField
                blockId={blockId}
                blockProps={props}
                fieldKey="headline_line2"
                as="em"
                value={headlineLine2}
                className="font-normal not-italic"
                style={line2BaseStyle}
              />
            </>
          ) : null}
        </h1>
      )
    }
    return (
      <BuilderTextField
        blockId={blockId}
        blockProps={props}
        fieldKey="headline"
        as="h1"
        value={headline}
        className={
          isSplit
            ? 'text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-5'
            : 'text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-5'
        }
        style={headlineBaseStyle}
      />
    )
  }

  const renderCtas = (centered = false) => (
    <div className={`flex gap-3 flex-wrap pt-1 items-start ${centered ? 'justify-center' : ''}`}>
      {ctaPrimary && (
        <BuilderCtaButton
          fieldKey="cta_primary"
          blockId={blockId}
          blockProps={props}
          label={ctaPrimary}
          href={ctaUrl}
          className={`font-bold text-sm shadow-lg hover:opacity-90 transition-opacity ${ctaPadClass}`}
          style={{
            backgroundColor: panelUsesDarkText ? '#fff' : style.primary_color,
            color: panelUsesDarkText ? style.primary_color : '#fff',
            borderRadius: ctaRadius,
          }}
          trailing={hasFashionHeadline && splitSideBySide ? <ArrowRight className="ml-2 h-4 w-4 inline" /> : undefined}
        />
      )}
      {ctaSecondary && ctaSecondary !== ctaPrimary && (
        <BuilderCtaButton
          fieldKey="cta_secondary"
          blockId={blockId}
          blockProps={props}
          label={ctaSecondary}
          href={ctaSecUrl}
          className={`font-semibold text-sm bg-transparent hover:opacity-80 transition-opacity ${ctaPadClass}`}
          style={{
            border: `2px solid ${panelUsesDarkText ? 'rgba(255,255,255,0.5)' : `${style.text_color}99`}`,
            color: heroText,
            borderRadius: ctaRadius,
          }}
        />
      )}
    </div>
  )

  const renderSideImage = (panelClass?: string) => {
    if (!isSplit) return null
    const panelCls = panelClass || (splitSideBySide
      ? `relative z-10 w-full ${imagePanelWidth} min-h-[420px] md:min-h-[640px]`
      : 'relative z-10 w-full flex-1 md:w-auto')
    return (
      <div
        className={panelCls}
        style={splitSideBySide && !panelClass ? { backgroundColor: style.surface_color || '#f3f4f6' } : undefined}
      >
        <MediaClipFrame
          clip={mediaClip}
          className={
            splitSideBySide || panelClass
              ? 'absolute inset-0 min-h-[420px] md:min-h-[640px]'
              : 'w-full'
          }
          style={
            !splitSideBySide && !panelClass && !clippedMedia
              ? { maxHeight: '640px', minHeight: hasSideImage ? '260px' : '220px' }
              : undefined
          }
        >
          {sideImageUrl ? (
            <img
              src={sideImageUrl}
              alt=""
              className={
                splitSideBySide || panelClass
                  ? 'absolute inset-0 h-full w-full min-h-[420px] md:min-h-[640px] object-cover'
                  : cn('w-full h-full object-cover', !clippedMedia && 'shadow-2xl rounded-2xl')
              }
              loading="lazy"
            />
          ) : (
            <div
              className={
                splitSideBySide || panelClass
                  ? 'absolute inset-0 min-h-[420px] md:min-h-[640px] flex items-center justify-center'
                  : cn('w-full h-56 flex items-center justify-center', !clippedMedia && 'rounded-2xl')
              }
              style={{
                background: panelUsesDarkText ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                border: panelUsesDarkText ? '2px dashed rgba(255,255,255,0.3)' : '2px dashed rgba(0,0,0,0.12)',
              }}
            >
              <span className={`text-sm font-medium ${panelUsesDarkText ? 'text-white/50' : 'text-gray-400'}`}>Hero Image</span>
            </div>
          )}
        </MediaClipFrame>
      </div>
    )
  }

  const renderTextPanel = (opts?: { centered?: boolean; className?: string; style?: CSSProperties }) => {
    const centered = opts?.centered ?? false
    return (
      <BuilderContentGroup
        blockId={blockId}
        blockProps={props}
        className={
          opts?.className
          ?? (splitSideBySide
            ? `space-y-5 relative z-10 flex-1 ${textPanelWidth} px-6 sm:px-12 py-16 lg:py-28 flex flex-col justify-center max-w-xl md:max-w-none`
            : isSplit
              ? 'space-y-5 relative z-10 flex-1 max-w-xl'
              : 'space-y-5 relative z-10 text-center max-w-3xl mx-auto')
        }
        style={opts?.style ?? (splitSideBySide ? { ...splitTextPanelStyle(), zIndex: 1 } : { zIndex: 1 })}
      >
        {renderEyebrow()}
        {renderHeadline()}
        {subtitle && subtitle !== headline && (
          <BuilderTextField
            blockId={blockId}
            blockProps={props}
            fieldKey="subtitle"
            as="p"
            value={subtitle}
            className={`text-base leading-relaxed max-w-lg text-pretty ${isSplit && !panelUsesDarkText ? 'opacity-80' : ''}`}
            style={{
              color: heroSubText,
              margin: isSplit && !centered ? undefined : '0 auto',
            }}
          />
        )}
        {renderCtas(centered || !isSplit)}
      </BuilderContentGroup>
    )
  }

  const dividerEl = showDivider && splitSideBySide ? (
    <div className="hidden md:block w-px bg-black/10 shrink-0 self-stretch" aria-hidden />
  ) : null

  if (isStacked) {
    return (
      <section className="relative overflow-hidden flex flex-col" style={{ color: heroText }}>
        <div className="relative w-full min-h-[280px] md:min-h-[360px] shrink-0">
          <MediaClipFrame clip={mediaClip} className="absolute inset-0">
            {sideImageUrl ? (
              <img src={sideImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <span className="text-sm font-medium text-gray-400">Hero Image</span>
              </div>
            )}
          </MediaClipFrame>
        </div>
        {renderTextPanel({
          className: 'space-y-5 relative z-10 px-6 sm:px-12 py-12 lg:py-16 flex flex-col justify-center max-w-3xl',
          style: splitTextPanelStyle(),
        })}
      </section>
    )
  }

  if (isOverlap) {
    return (
      <section className="relative overflow-hidden min-h-[420px] md:min-h-[520px]" style={{ color: heroText }}>
        <MediaClipFrame clip={mediaClip} className="absolute inset-0">
          {sideImageUrl ? (
            <img src={sideImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 bg-gray-200" />
          )}
        </MediaClipFrame>
        {props.overlay !== false && <div className="absolute inset-0 bg-black/35 z-0" />}
        <div className="absolute bottom-6 left-4 right-4 md:left-8 md:right-8 z-10">
          <div className="rounded-xl bg-white shadow-lg p-6 md:p-8 text-gray-900">
            {renderTextPanel({
              className: 'space-y-5 relative z-10 max-w-3xl',
              style: { zIndex: 1 },
            })}
          </div>
        </div>
      </section>
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

      {splitSideBySide && imageOnLeft ? (
        <>
          {renderSideImage()}
          {dividerEl}
          {renderTextPanel()}
        </>
      ) : splitSideBySide ? (
        <>
          {renderTextPanel()}
          {dividerEl}
          {renderSideImage()}
        </>
      ) : (
        <>
          {renderTextPanel()}
          {renderSideImage()}
        </>
      )}
    </section>
  )
}
