import { Copy, Quote, Star, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ContentSlider } from '../builder/ContentSlider'
import { SectionHeading } from '../builder/SectionHeading'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'
import {
  isFeaturedTestimonialLayout,
  normalizeTestimonialLayout,
  resolveTestimonialAutoSlide,
  testimonialSliderMode,
} from '../../lib/sectionSlider'
import { resolveTestimonialItems, TESTIMONIAL_DISPLAY_DEFAULTS } from '../../lib/testimonialDefaults'
import type { Block, TestimonialItem } from '../../types/builder'

interface TestimonialsBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  editable?: boolean
  onItemsChange?: (items: TestimonialItem[]) => void
}

function StarRating({ rating }: { rating: number }) {
  const n = Math.min(5, Math.max(0, Math.round(rating)))
  return (
    <div className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < n ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  )
}

function Avatar({ item, author }: { item: TestimonialItem; author: string }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt={author} className="h-12 w-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-700" />
  }
  const initial = author.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
      {initial}
    </span>
  )
}

function TestimonialCard({
  item,
  showRating,
  showAvatar,
  variant = 'grid',
}: {
  item: TestimonialItem
  showRating: boolean
  showAvatar: boolean
  variant?: 'grid' | 'featured'
}) {
  const isFeatured = variant === 'featured'
  return (
    <figure
      className={`flex h-full flex-col ${
        isFeatured
          ? 'rounded-2xl bg-gray-900 px-8 py-10 text-center text-white shadow-xl md:px-12 md:py-14'
          : 'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <Quote className={`mb-4 h-8 w-8 shrink-0 ${isFeatured ? 'mx-auto text-brand-400' : 'text-brand-500'}`} />
      <blockquote
        className={`flex-1 leading-relaxed ${isFeatured ? 'text-lg md:text-xl' : ''} ${!isFeatured && !hasItemTitleStyle(item.contentStyle) ? 'text-gray-700 dark:text-gray-200' : ''} ${isFeatured && !hasItemTitleStyle(item.contentStyle) ? 'text-white' : ''}`}
        style={itemTitleStyle(item.contentStyle)}
      >
        &ldquo;{item.quote}&rdquo;
      </blockquote>
      {showRating && item.rating != null && item.rating > 0 && (
        <div className={`mt-4 ${isFeatured ? 'flex justify-center' : ''}`}>
          <StarRating rating={item.rating} />
        </div>
      )}
      <figcaption className={`mt-6 flex items-center gap-3 ${isFeatured ? 'justify-center' : ''}`}>
        {showAvatar && <Avatar item={item} author={item.author} />}
        <div className={isFeatured ? 'text-left' : ''}>
          <p
            className={`font-semibold ${!hasItemDescriptionStyle(item.contentStyle) ? (isFeatured ? 'text-white' : DEFAULT_TITLE_CLASS) : ''}`}
            style={itemDescriptionStyle(item.contentStyle)}
          >
            {item.author}
          </p>
          {item.role && (
            <p
              className={`text-sm ${!hasItemDescriptionStyle(item.contentStyle) ? (isFeatured ? 'text-gray-400' : DEFAULT_SUBTITLE_CLASS) : ''}`}
              style={itemDescriptionStyle(item.contentStyle)}
            >
              {item.role}
            </p>
          )}
        </div>
      </figcaption>
    </figure>
  )
}

export function TestimonialsBlock({ block, layoutStyle, editable = false, onItemsChange }: TestimonialsBlockProps) {
  const { props } = block
  const items = resolveTestimonialItems(props)
  const layout = normalizeTestimonialLayout(props.testimonialLayout ?? TESTIMONIAL_DISPLAY_DEFAULTS.testimonialLayout)
  const autoSlide = resolveTestimonialAutoSlide(props)
  const sliderMode = testimonialSliderMode(autoSlide)
  const featured = isFeaturedTestimonialLayout(layout)
  const showRating = props.showTestimonialRating ?? TESTIMONIAL_DISPLAY_DEFAULTS.showTestimonialRating
  const showAvatar = props.showTestimonialAvatar ?? TESTIMONIAL_DISPLAY_DEFAULTS.showTestimonialAvatar
  const intervalSeconds = props.sliderIntervalSeconds

  const updateItems = (next: TestimonialItem[]) => onItemsChange?.(next)

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index))
  }

  const duplicateItem = (index: number) => {
    const item = items[index]
    if (!item || !onItemsChange) return
    const copy = { ...item, id: uuid(), author: item.author ? `${item.author} (copy)` : '' }
    const next = [...items]
    next.splice(index + 1, 0, copy)
    updateItems(next)
  }

  const wrapItem = (child: React.ReactNode, index: number) => {
    if (!editable || !onItemsChange) return child
    return (
      <div key={items[index]?.id ?? index} className="group relative h-full">
        {child}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title="Duplicate"
            onClick={() => duplicateItem(index)}
            className="rounded-lg bg-white p-1.5 text-gray-600 shadow ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-600"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={() => removeItem(index)}
            className="rounded-lg bg-white p-1.5 text-red-600 shadow ring-1 ring-gray-200 hover:bg-red-50 dark:bg-gray-800 dark:ring-gray-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const renderSingleSlide = (slideIndex: number) => {
    const item = items[slideIndex]
    if (!item) return null
    const widthClass = featured ? 'mx-auto max-w-3xl' : 'mx-auto max-w-2xl'
    return (
      <div className={widthClass}>
        {wrapItem(
          <TestimonialCard
            item={item}
            showRating={showRating}
            showAvatar={showAvatar}
            variant={featured ? 'featured' : 'grid'}
          />,
          slideIndex,
        )}
      </div>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <SectionHeading
        title={props.text}
        subtitle={props.subtitle}
        styles={block.styles}
        className="mb-10"
        titleClassName="text-3xl font-bold tracking-tight"
        subtitleClassName="mx-auto mt-3 max-w-2xl"
      />

      {items.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No testimonials yet — add them in the properties panel
        </p>
      ) : (
        <ContentSlider
          slideCount={items.length}
          mode={sliderMode}
          intervalSeconds={intervalSeconds}
          renderSlide={renderSingleSlide}
        />
      )}
    </section>
  )
}
