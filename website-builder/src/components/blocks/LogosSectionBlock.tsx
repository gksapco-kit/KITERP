import { Copy, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { BrandLogoCard } from '../builder/BrandLogoCard'
import { LogoCarouselSlider } from '../builder/LogoCarouselSlider'
import { LogosMarquee } from '../builder/LogosMarquee'
import { SectionHeading } from '../builder/SectionHeading'
import { LOGOS_DISPLAY_DEFAULTS, resolveLogoItems } from '../../lib/logosDefaults'
import {
  chunkIntoSlides,
  normalizeLogosLayout,
  sliderModeFromLayout,
} from '../../lib/sectionSlider'
import { hasCustomSubtitleColor, hasCustomTitleColor } from '../../lib/sectionTextStyles'
import type { Block, BlockStyles, LogoItem } from '../../types/builder'

interface LogosSectionBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  editable?: boolean
  onLogosChange?: (items: LogoItem[]) => void
}

function logosSectionLightText(styles: BlockStyles): boolean {
  if (styles.backgroundMode === 'gradient') return true
  const c = styles.textColor?.toLowerCase()
  return c === '#fff' || c === '#ffffff' || c === 'white'
}

export function LogosSectionBlock({ block, layoutStyle, editable = false, onLogosChange }: LogosSectionBlockProps) {
  const { props } = block
  const items = resolveLogoItems(props)
  const grayscale = props.logosGrayscale ?? LOGOS_DISPLAY_DEFAULTS.logosGrayscale
  const layout = normalizeLogosLayout(props.logosLayout ?? LOGOS_DISPLAY_DEFAULTS.logosLayout)
  const sliderMode = sliderModeFromLayout(layout)
  const columns = props.columns ?? LOGOS_DISPLAY_DEFAULTS.columns
  const perSlide = Math.max(2, Math.min(columns, 5))
  const intervalSeconds = props.sliderIntervalSeconds
  const lightText = logosSectionLightText(block.styles)
  const showBrandTile = props.logosShowBrandTile ?? LOGOS_DISPLAY_DEFAULTS.logosShowBrandTile
  const showBrandName = props.logosShowBrandNames ?? LOGOS_DISPLAY_DEFAULTS.logosShowBrandNames

  const updateLogos = (next: LogoItem[]) => onLogosChange?.(next)

  const removeLogo = (index: number) => {
    updateLogos(items.filter((_, i) => i !== index))
  }

  const duplicateLogo = (index: number) => {
    const item = items[index]
    if (!item || !onLogosChange) return
    const copy = { ...item, id: uuid(), name: item.name ? `${item.name} (copy)` : '' }
    const next = [...items]
    next.splice(index + 1, 0, copy)
    updateLogos(next)
  }

  const renderLogoCell = (item: LogoItem, globalIndex: number) => (
    <div key={item.id ?? globalIndex} className="group relative inline-block shrink-0">
      <BrandLogoCard
        item={item}
        grayscale={grayscale}
        lightText={lightText}
        showBrandTile={showBrandTile}
        showBrandName={showBrandName}
      />
      {editable && onLogosChange && (
        <LogoEditButtons onDuplicate={() => duplicateLogo(globalIndex)} onDelete={() => removeLogo(globalIndex)} />
      )}
    </div>
  )

  const slides = chunkIntoSlides(items, perSlide)

  const logoRow = (page: LogoItem[], startIndex: number) => (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-5">
      {page.map((item, i) => renderLogoCell(item, startIndex + i))}
    </div>
  )

  const renderSlide = (slideIndex: number) => {
    const page = slides[slideIndex] ?? []
    return logoRow(page, slideIndex * perSlide)
  }

  const renderMarqueeCell = (item: LogoItem, index: number) => (
    <div className="group relative shrink-0">
      <BrandLogoCard
        item={item}
        grayscale={grayscale}
        lightText={lightText}
        showBrandTile={showBrandTile}
        showBrandName={showBrandName}
      />
      {editable && onLogosChange && (
        <LogoEditButtons onDuplicate={() => duplicateLogo(index)} onDelete={() => removeLogo(index)} />
      )}
    </div>
  )

  const titleClass = lightText
    ? `text-lg font-bold uppercase tracking-[0.25em] sm:text-xl ${hasCustomTitleColor(block.styles) ? '' : 'text-white'}`
    : `text-lg font-bold uppercase tracking-[0.25em] sm:text-xl`

  const subtitleClass = lightText
    ? `mx-auto mt-2 max-w-xl text-sm sm:text-base ${hasCustomSubtitleColor(block.styles) ? '' : 'text-white/80'}`
    : 'mx-auto mt-2 max-w-xl text-sm sm:text-base'

  return (
    <section style={layoutStyle} className="w-full overflow-hidden rounded-xl">
      {(props.text || props.subtitle) && (
        <SectionHeading
          title={props.text?.trim() || undefined}
          subtitle={props.subtitle}
          styles={block.styles}
          className="mb-8 sm:mb-10"
          titleClassName={titleClass}
          subtitleClassName={subtitleClass}
          titleTag="h2"
        />
      )}

      {items.length === 0 ? (
        <p
          className={`rounded-xl border-2 border-dashed py-12 text-center text-sm ${
            lightText ? 'border-white/30 text-white/60' : 'border-gray-200 text-gray-400'
          }`}
        >
          No brands yet — add them in the properties panel
        </p>
      ) : layout === 'autoSlider' ? (
        <LogosMarquee items={items} intervalSeconds={intervalSeconds} renderCell={renderMarqueeCell} />
      ) : (
        <LogoCarouselSlider
          slideCount={slides.length}
          mode={sliderMode ?? 'manual'}
          intervalSeconds={intervalSeconds}
          renderSlide={renderSlide}
          lightControls={lightText}
        />
      )}
    </section>
  )
}

function LogoEditButtons({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  return (
    <div className="absolute -right-1 -top-1 z-20 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
      <button
        type="button"
        title="Duplicate"
        onClick={onDuplicate}
        className="rounded-md bg-white p-1 text-gray-600 shadow-md ring-1 ring-gray-200 hover:bg-gray-50"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Delete"
        onClick={onDelete}
        className="rounded-md bg-white p-1 text-red-600 shadow-md ring-1 ring-gray-200 hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
