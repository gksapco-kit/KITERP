import type { CSSProperties, ReactNode } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { renderFeatureIcon } from '@/lib/sectionItemLayout'
import { arrayItemImageFrameStyle, arrayItemImageRenderStyle } from '@/lib/sectionImageStyle'
import {
  genericTimelineContent,
  isTemplateTimelineBlock,
  sanitizeWellnessBodyCopy,
} from '@/lib/wellnessTemplateCopy'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'
import { cn, imgUrl } from '@/lib/utils'

/** 1×1 transparent pixel — keeps an empty editable slot from rendering a broken-image box. */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

type TimelineItem = { year: string; title: string; desc: string; image_url?: string }

type VisibleTimelineItem = { item: TimelineItem; index: number }

const STEP_ICONS = ['🌱', '🚀', '✨', '🎯', '💡', '🏆']

function TimelineBlockTitle({
  title,
  showTitle,
  blockId,
  props,
  textColor,
  fontHeading,
  className = 'text-3xl sm:text-4xl font-semibold mb-12 sm:mb-16 text-center',
}: {
  title: string | null | undefined
  showTitle: boolean
  blockId?: string
  props: Record<string, unknown>
  textColor: string
  fontHeading: string
  className?: string
}) {
  if (!showTitle) return null
  return (
    <BuilderTextField
      fieldKey="title"
      blockId={blockId}
      blockProps={props}
      value={title ?? ''}
      as="h2"
      className={className}
      style={{ fontFamily: fontHeading, color: textColor }}
      placeholder="Section title"
    />
  )
}

function TimelineYearField({
  item,
  index,
  blockId,
  props,
  useReplacement,
  className,
  style,
}: {
  item: TimelineItem
  index: number
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  className?: string
  style?: CSSProperties
}) {
  if (isNestedBlockFieldHidden(props, `items.${index}.year`)) return null
  if (useReplacement) {
    return (
      <span className={className} style={style}>
        {sanitizeWellnessBodyCopy(item.year)}
      </span>
    )
  }
  return (
    <BuilderTextField
      fieldKey={`items.${index}.year`}
      blockId={blockId}
      blockProps={props}
      value={item.year}
      as="span"
      skipPositionWrapper
      className={className}
      style={style}
      placeholder="2024"
    />
  )
}

function TimelineTitleField({
  item,
  index,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  className = 'font-semibold text-lg sm:text-xl mb-2',
}: {
  item: TimelineItem
  index: number
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  className?: string
}) {
  if (isNestedBlockFieldHidden(props, `items.${index}.title`)) return null
  if (useReplacement) {
    return (
      <h3 className={className} style={{ fontFamily: fontHeading, color: textColor }}>
        {sanitizeWellnessBodyCopy(item.title)}
      </h3>
    )
  }
  return (
    <BuilderTextField
      fieldKey={`items.${index}.title`}
      blockId={blockId}
      blockProps={props}
      value={item.title}
      as="h3"
      className={className}
      style={{ fontFamily: fontHeading, color: textColor }}
      placeholder="Milestone title"
    />
  )
}

function TimelineDescField({
  item,
  index,
  blockId,
  props,
  useReplacement,
  textColor,
  className = 'text-sm sm:text-base leading-relaxed opacity-75',
}: {
  item: TimelineItem
  index: number
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  className?: string
}) {
  if (isNestedBlockFieldHidden(props, `items.${index}.desc`)) return null
  if (useReplacement) {
    return (
      <p className={className} style={{ color: textColor }}>
        {sanitizeWellnessBodyCopy(item.desc)}
      </p>
    )
  }
  return (
    <BuilderTextField
      fieldKey={`items.${index}.desc`}
      blockId={blockId}
      blockProps={props}
      value={item.desc}
      as="p"
      multiline
      className={className}
      style={{ color: textColor }}
      placeholder="Description"
    />
  )
}

function TimelineImage({
  item,
  index,
  blockId,
  props,
  useReplacement,
  align = 'left',
}: {
  item: TimelineItem
  index: number
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  align?: 'left' | 'center' | 'right'
}) {
  const builderCanvas = useBuilderCanvas()
  const allowEditing = Boolean(builderCanvas?.isEditorCanvas && blockId) && !useReplacement
  if (isNestedBlockFieldHidden(props, `items.${index}.image_url`)) return null

  const hasImage = Boolean(item.image_url)
  // On the live site, render nothing when there's no image (keeps existing timelines unchanged).
  if (!hasImage && !allowEditing) return null

  const frameAlign = align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : 'mr-auto'

  return (
    <div
      className={cn('relative mb-4 w-full max-w-[240px] overflow-hidden rounded-xl aspect-[4/3]', frameAlign)}
      style={arrayItemImageFrameStyle(item as Record<string, unknown>)}
    >
      {allowEditing ? (
        <BuilderSectionImage
          blockId={blockId}
          field="image_url"
          arrayKey="items"
          index={index}
          itemField="image_url"
          blockProps={props}
          src={item.image_url ? imgUrl(item.image_url) : TRANSPARENT_PIXEL}
          alt={item.image_url ? item.title : ''}
          className="h-full w-full object-cover"
          empty={!item.image_url}
        />
      ) : (
        <img
          src={imgUrl(item.image_url as string)}
          alt={item.title}
          className="h-full w-full object-cover"
          style={arrayItemImageRenderStyle(item as Record<string, unknown>, props)}
          loading="lazy"
        />
      )}
    </div>
  )
}

function TimelineItemBody({
  item,
  index,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  align = 'left',
}: {
  item: TimelineItem
  index: number
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  align?: 'left' | 'center' | 'right'
}) {
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  return (
    <div className={cn('min-w-0', alignClass)}>
      <TimelineImage
        item={item}
        index={index}
        blockId={blockId}
        props={props}
        useReplacement={useReplacement}
        align={align}
      />
      <TimelineTitleField
        item={item}
        index={index}
        blockId={blockId}
        props={props}
        useReplacement={useReplacement}
        textColor={textColor}
        fontHeading={fontHeading}
      />
      <TimelineDescField
        item={item}
        index={index}
        blockId={blockId}
        props={props}
        useReplacement={useReplacement}
        textColor={textColor}
      />
    </div>
  )
}

function YearBadge({
  item,
  index,
  blockId,
  props,
  useReplacement,
  primaryColor,
  compact = false,
  className,
}: {
  item: TimelineItem
  index: number
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  primaryColor: string
  compact?: boolean
  className?: string
}) {
  if (isNestedBlockFieldHidden(props, `items.${index}.year`)) return null
  return (
    <div
      className={cn(
        'rounded-2xl flex items-center justify-center text-white font-bold shrink-0 text-center px-1 leading-tight',
        compact ? 'w-12 h-12 text-[9px]' : 'w-16 h-16 sm:w-20 sm:h-20 text-[10px] sm:text-xs',
        className,
      )}
      style={{ backgroundColor: primaryColor }}
    >
      <TimelineYearField
        item={item}
        index={index}
        blockId={blockId}
        props={props}
        useReplacement={useReplacement}
      />
    </div>
  )
}

function IconMarker({
  index,
  primaryColor,
  compact = false,
}: {
  index: number
  primaryColor: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center shrink-0',
        compact ? 'w-10 h-10 text-lg' : 'w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl',
      )}
      style={{ backgroundColor: `${primaryColor}18` }}
    >
      {renderFeatureIcon(STEP_ICONS[index % STEP_ICONS.length])}
    </div>
  )
}

function DotMarker({ primaryColor }: { primaryColor: string }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 z-10 ring-4 ring-white"
      style={{ backgroundColor: primaryColor }}
    />
  )
}

function VerticalTimeline({
  visibleItems,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  primaryColor,
  showIcons,
  cardStyle,
  isDark,
}: {
  visibleItems: VisibleTimelineItem[]
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  primaryColor: string
  showIcons: boolean
  cardStyle: string
  isDark: boolean
}) {
  if (cardStyle === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {visibleItems.map(({ item, index: i }) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl border p-6 flex flex-col gap-4',
              isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white shadow-sm',
            )}
          >
            {showIcons ? (
              <IconMarker index={i} primaryColor={primaryColor} />
            ) : (
              <YearBadge
                item={item}
                index={i}
                blockId={blockId}
                props={props}
                useReplacement={useReplacement}
                primaryColor={primaryColor}
                className="self-start"
              />
            )}
            <TimelineItemBody
              item={item}
              index={i}
              blockId={blockId}
              props={props}
              useReplacement={useReplacement}
              textColor={textColor}
              fontHeading={fontHeading}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-8 sm:left-10 top-2 bottom-2 w-px opacity-20" style={{ backgroundColor: textColor }} />
      <div className="space-y-10 sm:space-y-12">
        {visibleItems.map(({ item, index: i }) => (
          <div key={i} className="flex gap-5 sm:gap-8 items-start relative">
            {showIcons ? (
              <IconMarker index={i} primaryColor={primaryColor} />
            ) : (
              <YearBadge
                item={item}
                index={i}
                blockId={blockId}
                props={props}
                useReplacement={useReplacement}
                primaryColor={primaryColor}
                className="z-10"
              />
            )}
            <div className="pt-2 sm:pt-3 min-w-0 flex-1">
              <TimelineItemBody
                item={item}
                index={i}
                blockId={blockId}
                props={props}
                useReplacement={useReplacement}
                textColor={textColor}
                fontHeading={fontHeading}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListTimeline({
  visibleItems,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  primaryColor,
  isDark,
}: {
  visibleItems: VisibleTimelineItem[]
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  primaryColor: string
  isDark: boolean
}) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {visibleItems.map(({ item, index: i }) => (
        <div
          key={i}
          className={cn(
            'flex gap-4 items-start rounded-xl px-4 py-3 border',
            isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white/80',
          )}
        >
          {!isNestedBlockFieldHidden(props, `items.${i}.year`) && (
            <span
              className="text-xs font-bold uppercase tracking-wide shrink-0 pt-1"
              style={{ color: primaryColor }}
            >
              <TimelineYearField
                item={item}
                index={i}
                blockId={blockId}
                props={props}
                useReplacement={useReplacement}
              />
            </span>
          )}
          <TimelineItemBody
            item={item}
            index={i}
            blockId={blockId}
            props={props}
            useReplacement={useReplacement}
            textColor={textColor}
            fontHeading={fontHeading}
          />
        </div>
      ))}
    </div>
  )
}

function HorizontalTimeline({
  visibleItems,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  primaryColor,
  compact,
}: {
  visibleItems: VisibleTimelineItem[]
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  primaryColor: string
  compact: boolean
}) {
  return (
    <div className={cn('flex flex-wrap justify-center', compact ? 'gap-6' : 'gap-10')}>
      {visibleItems.map(({ item, index: i }) => (
        <div
          key={i}
          className={cn('flex flex-col items-center text-center', compact ? 'max-w-[140px]' : 'max-w-[180px]')}
        >
          <YearBadge
            item={item}
            index={i}
            blockId={blockId}
            props={props}
            useReplacement={useReplacement}
            primaryColor={primaryColor}
            compact={compact}
            className="mb-3"
          />
          <TimelineItemBody
            item={item}
            index={i}
            blockId={blockId}
            props={props}
            useReplacement={useReplacement}
            textColor={textColor}
            fontHeading={fontHeading}
            align="center"
          />
        </div>
      ))}
    </div>
  )
}

function AlternatingTimeline({
  visibleItems,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  primaryColor,
}: {
  visibleItems: VisibleTimelineItem[]
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  primaryColor: string
}) {
  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 opacity-20" style={{ backgroundColor: textColor }} />
      <div className="space-y-12">
        {visibleItems.map(({ item, index: i }) => {
          const isRight = i % 2 === 1
          return (
            <div
              key={i}
              className={cn(
                'grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center',
                isRight && 'md:[direction:rtl]',
              )}
            >
              <div className={cn('md:[direction:ltr]', isRight ? 'md:text-right' : 'md:text-left')}>
                <TimelineItemBody
                  item={item}
                  index={i}
                  blockId={blockId}
                  props={props}
                  useReplacement={useReplacement}
                  textColor={textColor}
                  fontHeading={fontHeading}
                  align={isRight ? 'right' : 'left'}
                />
              </div>
              <div className={cn('flex', isRight ? 'md:justify-start' : 'md:justify-end md:[direction:ltr]')}>
                <YearBadge
                  item={item}
                  index={i}
                  blockId={blockId}
                  props={props}
                  useReplacement={useReplacement}
                  primaryColor={primaryColor}
                  className="z-10"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProgressTimeline({
  visibleItems,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  primaryColor,
}: {
  visibleItems: VisibleTimelineItem[]
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  primaryColor: string
}) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="relative flex justify-between items-start gap-2 overflow-x-auto pb-2">
        <div
          className="absolute left-0 right-0 top-8 sm:top-10 h-0.5 opacity-25"
          style={{ backgroundColor: primaryColor }}
        />
        {visibleItems.map(({ item, index: i }) => (
          <div key={i} className="relative flex flex-col items-center text-center min-w-[100px] flex-1 z-10">
            <YearBadge
              item={item}
              index={i}
              blockId={blockId}
              props={props}
              useReplacement={useReplacement}
              primaryColor={primaryColor}
              compact
              className="mb-3"
            />
            <TimelineItemBody
              item={item}
              index={i}
              blockId={blockId}
              props={props}
              useReplacement={useReplacement}
              textColor={textColor}
              fontHeading={fontHeading}
              align="center"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function MinimalTimeline({
  visibleItems,
  blockId,
  props,
  useReplacement,
  textColor,
  fontHeading,
  primaryColor,
}: {
  visibleItems: VisibleTimelineItem[]
  blockId?: string
  props: Record<string, unknown>
  useReplacement: boolean
  textColor: string
  fontHeading: string
  primaryColor: string
}) {
  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="absolute left-[5px] top-2 bottom-2 w-px opacity-20" style={{ backgroundColor: textColor }} />
      <div className="space-y-8">
        {visibleItems.map(({ item, index: i }) => (
          <div key={i} className="flex gap-5 items-start pl-0">
            <DotMarker primaryColor={primaryColor} />
            <div className="min-w-0 flex-1 -mt-1">
              {!isNestedBlockFieldHidden(props, `items.${i}.year`) && (
                <p className="text-xs font-bold uppercase tracking-wide mb-1 opacity-60" style={{ color: primaryColor }}>
                  <TimelineYearField
                    item={item}
                    index={i}
                    blockId={blockId}
                    props={props}
                    useReplacement={useReplacement}
                  />
                </p>
              )}
              <TimelineItemBody
                item={item}
                index={i}
                blockId={blockId}
                props={props}
                useReplacement={useReplacement}
                textColor={textColor}
                fontHeading={fontHeading}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderTimelineLayout(
  layout: string,
  args: {
    visibleItems: VisibleTimelineItem[]
    blockId?: string
    props: Record<string, unknown>
    useReplacement: boolean
    textColor: string
    fontHeading: string
    primaryColor: string
    showIcons: boolean
    cardStyle: string
    isDark: boolean
    compact: boolean
  },
): ReactNode {
  const { visibleItems, blockId, props, useReplacement, textColor, fontHeading, primaryColor, showIcons, cardStyle, isDark, compact } = args

  switch (layout) {
    case 'list':
      return (
        <ListTimeline
          visibleItems={visibleItems}
          blockId={blockId}
          props={props}
          useReplacement={useReplacement}
          textColor={textColor}
          fontHeading={fontHeading}
          primaryColor={primaryColor}
          isDark={isDark}
        />
      )
    case 'horizontal':
      return (
        <HorizontalTimeline
          visibleItems={visibleItems}
          blockId={blockId}
          props={props}
          useReplacement={useReplacement}
          textColor={textColor}
          fontHeading={fontHeading}
          primaryColor={primaryColor}
          compact={compact}
        />
      )
    case 'alternating':
      return (
        <AlternatingTimeline
          visibleItems={visibleItems}
          blockId={blockId}
          props={props}
          useReplacement={useReplacement}
          textColor={textColor}
          fontHeading={fontHeading}
          primaryColor={primaryColor}
        />
      )
    case 'progress':
      return (
        <ProgressTimeline
          visibleItems={visibleItems}
          blockId={blockId}
          props={props}
          useReplacement={useReplacement}
          textColor={textColor}
          fontHeading={fontHeading}
          primaryColor={primaryColor}
        />
      )
    case 'minimal':
      return (
        <MinimalTimeline
          visibleItems={visibleItems}
          blockId={blockId}
          props={props}
          useReplacement={useReplacement}
          textColor={textColor}
          fontHeading={fontHeading}
          primaryColor={primaryColor}
        />
      )
    case 'vertical':
    default:
      return (
        <VerticalTimeline
          visibleItems={visibleItems}
          blockId={blockId}
          props={props}
          useReplacement={useReplacement}
          textColor={textColor}
          fontHeading={fontHeading}
          primaryColor={primaryColor}
          showIcons={showIcons}
          cardStyle={cardStyle}
          isDark={isDark}
        />
      )
  }
}

export default function TimelineBlock({ site, style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const useReplacement = !isEditorCanvas && isTemplateTimelineBlock(props)
  const replacement = useReplacement ? genericTimelineContent(site.name) : null

  const title = useReplacement && replacement?.title
    ? sanitizeWellnessBodyCopy(replacement.title)
    : resolveBlockTextField(props, 'title', { sanitize: sanitizeWellnessBodyCopy })

  const rawItems = useReplacement && replacement
    ? replacement.items
    : ((props.items as TimelineItem[] | undefined) || [])

  const visibleItems: VisibleTimelineItem[] = useReplacement
    ? rawItems.map((item, index) => ({ item, index }))
    : visibleArrayEntries(rawItems, props, 'items')

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const layout = String(props.layout ?? 'vertical')
  const cardStyle = String(props.card_style ?? '')
  const showIcons = props.show_icons === true
  const compact = props.compact === true
  const surface = resolveSectionSurface(props, style)
  const textColor = surface.color
  const primaryColor = style.primary_color || '#274832'
  const fontHeading = style.font_heading || 'inherit'

  const sectionWidthClass = layout === 'horizontal' || layout === 'progress' || layout === 'alternating'
    ? 'max-w-6xl'
    : layout === 'list' || layout === 'minimal'
      ? 'max-w-4xl'
      : cardStyle === 'card'
        ? 'max-w-5xl'
        : 'max-w-3xl'

  if (visibleItems.length === 0 && !showTitle) {
    return (
      <section
        className={cn('py-16 sm:py-24 px-6 sm:px-12 mx-auto', sectionWidthClass)}
        style={{ background: surface.background, color: textColor }}
      >
        <TimelineBlockTitle
          title={title}
          showTitle={showTitle}
          blockId={blockId}
          props={props}
          textColor={textColor}
          fontHeading={fontHeading}
        />
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? undefined}
          message="Share milestones — when you started, how you grew, or steps in your process."
        />
      </section>
    )
  }

  return (
    <section
      className={cn('py-16 sm:py-24 px-6 sm:px-12 mx-auto', sectionWidthClass)}
      style={{ background: surface.background, color: textColor }}
    >
      <TimelineBlockTitle
        title={title}
        showTitle={showTitle}
        blockId={blockId}
        props={props}
        textColor={textColor}
        fontHeading={fontHeading}
      />
      {renderTimelineLayout(layout, {
        visibleItems,
        blockId,
        props,
        useReplacement,
        textColor,
        fontHeading,
        primaryColor,
        showIcons,
        cardStyle,
        isDark: surface.isDark,
        compact,
      })}
    </section>
  )
}
