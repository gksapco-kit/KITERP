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
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderContentGroup } from '@/components/builder/BuilderContentGroup'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { readSectionImageLayer } from '@/lib/sectionImageStyle'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { storeApi, type StoreLocation } from '@/api/store'
import { branchWelcomeHeadline } from '@/lib/branchStorefrontIdentity'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { useBranch } from '@/contexts/BranchContext'
import { isSharpSiteRadius, siteRadiusPx } from '@/lib/siteBorderRadius'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import {
  BUILDER_SECTION_INSET_X,
  builderSectionContainerWithMax,
  builderSectionInsetClass,
} from '@/lib/builderSectionLayout'
import { HeroBannerCarousel } from '@/home-sections/HeroBannerCarousel'
import { heroUsesBannerCarousel, resolveHeroBackgroundUrls } from '@/home-sections/heroBanners'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
  blockId?: string
}

export default function HeroBlock({ site, style, props, blockType, blockId, branchCode: branchFromBlocks }: Props) {
  const canvas = useBuilderCanvas()
  const isEditorCanvas = canvas?.isEditorCanvas && !!blockId
  const effectiveVendor = useEffectiveVendor()
  const [searchParams] = useSearchParams()
  const { selectedBranch: branchFromContext } = useBranch()
  const [branches, setBranches] = useState<StoreLocation[]>([])

  useEffect(() => {
    let cancelled = false
    storeApi.listBranches()
      .then((r) => { if (!cancelled) setBranches(r.stores || []) })
      .catch(() => { if (!cancelled) setBranches([]) })
    return () => { cancelled = true }
  }, [])

  const effectiveBranchKey = searchParams.get('branch') || branchFromBlocks || null

  const selectedBranch = useMemo(() => {
    if (branchFromContext && effectiveBranchKey) {
      const ctxKey = branchFromContext.code || branchFromContext.id
      if (ctxKey === effectiveBranchKey || branchFromContext.code === effectiveBranchKey || branchFromContext.id === effectiveBranchKey) {
        return branchFromContext
      }
    }
    const key = (effectiveBranchKey ?? '').trim()
    if (!key) return null
    return branches.find((b) => b.code === key || b.id === key) ?? null
  }, [branches, effectiveBranchKey, branchFromContext])

  const brandName = effectiveVendor?.display_name?.trim() || 'Welcome'
  const headline = resolveBlockTextField(props, 'headline', {
    sanitize: sanitizeWellnessBodyCopy,
    fallback: () => {
      if (isEditorCanvas) return null
      if (selectedBranch) return branchWelcomeHeadline(selectedBranch, effectiveVendor ?? undefined)
      if (brandName !== 'Welcome') return `Welcome to ${brandName}`
      return 'Welcome'
    },
  })
  const headlineLine2 = resolveBlockTextField(props, 'headline_line2', {
    sanitize: sanitizeWellnessBodyCopy,
  })
  const eyebrow = resolveBlockTextField(props, 'eyebrow', {
    sanitize: sanitizeWellnessBodyCopy,
  })
  const eyebrowPlain = props.eyebrow_plain === true
  const subtitle = resolveBlockTextField(props, 'subtitle', {
    sanitize: sanitizeWellnessBodyCopy,
  })
  const ctaPrimary = resolveBlockTextField(props, 'cta_primary', {
    sanitize: sanitizeWellnessBodyCopy,
  })
  const ctaSecondary = resolveBlockTextField(props, 'cta_secondary', {
    sanitize: sanitizeWellnessCtaLabel,
  })
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
  const sideImageHidden = isBlockFieldHidden(props, 'image_url')
  const bgImageHidden = isBlockFieldHidden(props, 'bg_image_url')
  const showSideImage = isSplit && !sideImageHidden
  const isStacked = isSplit && layoutMode === 'stacked'
  const isOverlap = isSplit && layoutMode === 'overlap'
  const isSplitPanel = isSplit && layoutMode === 'split' && !isStacked && !isOverlap && showSideImage
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
  const sideImageUrl = sideImageRaw ? imgUrl(sideImageRaw) : undefined

  const heroBackgroundUrls = useMemo(
    () => resolveHeroBackgroundUrls({
      explicitUrl: heroImageRaw,
      vendor: effectiveVendor,
    }),
    [heroImageRaw, effectiveVendor],
  )
  const heroPrimaryUrl = heroBackgroundUrls[0] ? imgUrl(heroBackgroundUrls[0]) : undefined
  const useBannerCarousel = heroUsesBannerCarousel(
    heroBackgroundUrls.length,
    props.banner_carousel as boolean | undefined,
  )

  const hasSideImage = isSplit && !!sideImageUrl
  const hasBgImg = heroBackgroundUrls.length > 0
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

  const heroBgImage = heroUsesImageBg && heroBackgroundUrls.length === 1 && heroPrimaryUrl
    ? `url(${heroPrimaryUrl})`
    : undefined
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

  const squareCta = props.cta_square === true || isSharpSiteRadius(style.border_radius)
  const ctaRadius = squareCta ? 0 : siteRadiusPx(style.border_radius)
  const ctaPadClass = squareCta
    ? 'px-7 h-12 inline-flex items-center justify-center box-border'
    : 'px-6 h-12 inline-flex items-center justify-center box-border'

  const hasFashionHeadline = !!headlineLine2 || eyebrowPlain

  const renderEyebrow = () => {
    if (isBlockFieldHidden(props, 'eyebrow')) return null
    if (!eyebrow && !eyebrowPlain && !isEditorCanvas) return null
    if (eyebrowPlain) {
      return (
        <BuilderTextField
          blockId={blockId}
          blockProps={props}
          fieldKey="eyebrow"
          as="span"
          value={eyebrow ?? ''}
          className="text-xs uppercase tracking-[0.3em] opacity-70 block"
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
        className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{
          backgroundColor: panelUsesDarkText ? 'rgba(255,255,255,0.15)' : `${style.accent_color}22`,
          color: panelUsesDarkText ? '#fff' : style.accent_color,
        }}
      />
    )
  }

  const renderHeadline = () => {
    if (isBlockFieldHidden(props, 'headline') && isBlockFieldHidden(props, 'headline_line2')) {
      return null
    }
    const headlineBaseStyle = {
      fontFamily: style.font_heading,
      color: heroText,
    }
    const line2BaseStyle = {
      fontStyle: 'italic' as const,
      color: panelUsesDarkText ? 'rgba(255,255,255,0.95)' : style.accent_color,
    }

    if (headlineLine2 || (isSplit && hasFashionHeadline)) {
      if (isBlockFieldHidden(props, 'headline') && !headlineLine2) return null
      if (!headline && !headlineLine2 && !isEditorCanvas) return null
      return (
        <h1
          className={
            isSplit
              ? hasFashionHeadline
                ? cn(
                    'font-semibold leading-[0.95] text-balance text-[clamp(1.65rem,4vw_+_0.45rem,2.65rem)] sm:text-[clamp(2rem,4.5vw_+_0.45rem,3.25rem)] lg:text-[clamp(2.35rem,5vw_+_0.5rem,3.75rem)]',
                    !splitSideBySide && 'mb-5',
                  )
                : cn('text-4xl sm:text-5xl md:text-6xl font-semibold leading-[0.95]', !splitSideBySide && 'mb-5')
              : 'text-3xl font-extrabold leading-tight mb-5'
          }
        >
          {!isBlockFieldHidden(props, 'headline') ? (
          <BuilderTextField
            blockId={blockId}
            blockProps={props}
            fieldKey="headline"
            as="span"
            value={headline ?? ''}
            className="block font-semibold"
            style={headlineBaseStyle}
          />
          ) : null}
          {headlineLine2 && !isBlockFieldHidden(props, 'headline_line2') ? (
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
    if (isBlockFieldHidden(props, 'headline')) return null
    if (!headline && !isEditorCanvas) return null
    return (
      <BuilderTextField
        blockId={blockId}
        blockProps={props}
        fieldKey="headline"
        as="h1"
        value={headline ?? ''}
        className={
          isSplit
            ? cn('text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight', !splitSideBySide && 'mb-5')
            : 'text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-5'
        }
        style={headlineBaseStyle}
      />
    )
  }

  const renderCtas = (centered = false) => {
    const showPrimary = ctaPrimary && !isBlockFieldHidden(props, 'cta_primary')
    const showSecondary = ctaSecondary && !isBlockFieldHidden(props, 'cta_secondary') && ctaSecondary !== ctaPrimary
    if (!showPrimary && !showSecondary) return null
    return (
    <div className={`flex gap-3 flex-wrap items-center ${centered ? 'justify-center' : ''}`}>
      {showPrimary && (
        <BuilderCtaButton
          fieldKey="cta_primary"
          blockId={blockId}
          blockProps={props}
          label={ctaPrimary!}
          href={ctaUrl}
          className={`font-bold text-sm shadow-lg hover:opacity-90 transition-opacity ${ctaPadClass}`}
          style={{
            backgroundColor: panelUsesDarkText ? '#fff' : style.primary_color,
            color: panelUsesDarkText ? style.primary_color : '#fff',
            borderRadius: ctaRadius,
          }}
          trailing={hasFashionHeadline && splitSideBySide ? <ArrowRight className="ml-2 h-4 w-4 inline" /> : undefined}
          allowElementDelete={isEditorCanvas}
        />
      )}
      {showSecondary && (
        <BuilderCtaButton
          fieldKey="cta_secondary"
          blockId={blockId}
          blockProps={props}
          label={ctaSecondary!}
          href={ctaSecUrl}
          className={`font-semibold text-sm bg-transparent hover:opacity-80 transition-opacity ${ctaPadClass}`}
          style={{
            border: `2px solid ${panelUsesDarkText ? 'rgba(255,255,255,0.5)' : `${style.text_color}99`}`,
            color: heroText,
            borderRadius: ctaRadius,
          }}
          allowElementDelete={isEditorCanvas}
        />
      )}
    </div>
    )
  }

  const sideImageBehindText = isSplit && readSectionImageLayer('image_url', props) === 'back'

  const renderSideImage = (panelClass?: string) => {
    if (!showSideImage) return null
    // "Send to back" drops the image panel below the text panel (z-index 1) so
    // overflowing headlines sit on top of the photo instead of behind it.
    const layerZ = sideImageBehindText ? 'z-0' : 'z-10'
    const panelCls = panelClass || (splitSideBySide
      ? `relative ${layerZ} h-full min-h-[280px] w-full min-w-0${showDivider ? ' md:border-l md:border-black/10' : ''}`
      : `relative ${layerZ} w-full flex-1 md:w-auto`)
    return (
      <div
        className={panelCls}
        style={splitSideBySide && !panelClass ? { backgroundColor: style.surface_color || '#f3f4f6' } : undefined}
      >
        <MediaClipFrame
          clip={mediaClip}
          className={
            splitSideBySide || panelClass
              ? 'absolute inset-0 h-full w-full'
              : 'w-full'
          }
          style={
            !splitSideBySide && !panelClass && !clippedMedia
              ? { maxHeight: '640px', minHeight: hasSideImage ? '260px' : '220px' }
              : undefined
          }
        >
          {sideImageUrl ? (
            <div className={splitSideBySide || panelClass ? 'absolute inset-0' : 'h-full w-full'}>
              <BuilderSectionImage
                blockId={blockId}
                field="image_url"
                blockProps={props}
                src={sideImageUrl}
                className={
                  splitSideBySide || panelClass
                    ? 'block h-full w-full object-cover object-center'
                    : cn('w-full h-full', !clippedMedia && 'shadow-2xl rounded-2xl')
                }
              />
            </div>
          ) : (
            <div
              className={
                splitSideBySide || panelClass
                  ? 'absolute inset-0 flex h-full w-full items-center justify-center'
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
            ? cn(
                BUILDER_SECTION_INSET_X,
                'relative z-10 flex h-full min-h-[280px] w-full min-w-0 flex-col items-start justify-center gap-5 py-12 lg:py-16',
              )
            : isSplit
              ? 'relative z-10 flex flex-1 max-w-xl flex-col gap-5'
              : 'relative z-10 mx-auto flex max-w-3xl flex-col gap-5 text-center')
        }
        style={opts?.style ?? (splitSideBySide ? { ...splitTextPanelStyle(), zIndex: 1 } : { zIndex: 1 })}
      >
        {renderEyebrow()}
        {renderHeadline()}
        {!isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas) && subtitle !== headline && (
          <BuilderTextField
            blockId={blockId}
            blockProps={props}
            fieldKey="subtitle"
            as="p"
            value={subtitle ?? ''}
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

  if (isStacked) {
    return (
      <section className="relative overflow-hidden flex flex-col" style={{ color: heroText }}>
        {showSideImage ? (
        <div className="relative w-full min-h-[280px] md:min-h-[360px] shrink-0">
          <MediaClipFrame clip={mediaClip} className="absolute inset-0">
            {sideImageUrl ? (
              <BuilderSectionImage
                blockId={blockId}
                field="image_url"
                blockProps={props}
                src={sideImageUrl}
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <span className="text-sm font-medium text-gray-400">Hero Image</span>
              </div>
            )}
          </MediaClipFrame>
        </div>
        ) : null}
        {renderTextPanel({
          className: builderSectionContainerWithMax(
            'max-w-3xl',
            'space-y-5 relative z-10 py-12 lg:py-16 flex flex-col justify-center',
          ),
          style: splitTextPanelStyle(),
        })}
      </section>
    )
  }

  if (isOverlap) {
    return (
      <section className="relative overflow-hidden min-h-[420px] md:min-h-[520px]" style={{ color: heroText }}>
        {showSideImage ? (
        <MediaClipFrame clip={mediaClip} className="absolute inset-0">
          {sideImageUrl ? (
            <BuilderSectionImage
              blockId={blockId}
              field="image_url"
              blockProps={props}
              src={sideImageUrl}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="absolute inset-0 bg-gray-200" />
          )}
        </MediaClipFrame>
        ) : null}
        {showSideImage && props.overlay !== false && <div className="absolute inset-0 bg-black/35 z-0" />}
        <div className={cn('absolute bottom-6 z-10', builderSectionInsetClass('left-0 right-0'))}>
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

  const centeredImageHeroClass =
    heroUsesImageBg && !splitSideBySide && !isSplit
      ? cn(BUILDER_SECTION_INSET_X, 'relative py-24 min-h-[72vh] flex items-center justify-center overflow-hidden')
      : cn(BUILDER_SECTION_INSET_X, 'relative py-24')

  return (
    <section
      className={
        splitSideBySide
          ? cn(
              'relative grid min-h-[min(420px,72vh)] grid-cols-1 overflow-hidden md:min-h-[min(560px,78vh)] md:items-stretch',
              wideImage ? 'md:grid-cols-[2fr_3fr]' : 'md:grid-cols-2',
            )
          : isSplit
            ? cn(BUILDER_SECTION_INSET_X, 'relative flex flex-col md:flex-row items-center gap-10 py-16')
            : centeredImageHeroClass
      }
      style={
        splitSideBySide
          ? { color: heroText, borderBottom: `1px solid ${style.text_color}18` }
          : {
              background: heroBg,
              backgroundImage: isEditorCanvas && heroUsesImageBg ? undefined : heroBgImage,
              backgroundSize: isEditorCanvas && heroUsesImageBg ? undefined : 'cover',
              backgroundPosition: isEditorCanvas && heroUsesImageBg ? undefined : 'center',
              color: heroText,
            }
      }
    >
      {heroUsesImageBg && heroBackgroundUrls.length > 0 && !bgImageHidden ? (
        <div className="absolute inset-0 z-0">
          {useBannerCarousel ? (
            <HeroBannerCarousel urls={heroBackgroundUrls} />
          ) : isEditorCanvas && blockId && heroImageRaw ? (
            <BuilderSectionImage
              blockId={blockId}
              field="bg_image_url"
              blockProps={props}
              src={heroPrimaryUrl!}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img
              src={heroPrimaryUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          )}
        </div>
      ) : null}
      {heroUsesImageBg && bgStyle === 'gradient' && (
        <div className="absolute inset-0 z-0" style={{ background: heroGrad, opacity: props.overlay === false ? 0.55 : 0.82 }} />
      )}
      {heroUsesImageBg && bgStyle === 'image' && props.overlay !== false && (
        <div className="absolute inset-0 bg-black/45 z-0" />
      )}

      {splitSideBySide && imageOnLeft ? (
        <>
          {renderSideImage()}
          {renderTextPanel()}
        </>
      ) : splitSideBySide ? (
        <>
          {renderTextPanel()}
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
