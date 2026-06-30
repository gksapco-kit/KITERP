import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
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

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

type TimelineItem = { year: string; title: string; desc: string }

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

  const visibleItems = useReplacement
    ? rawItems.map((item, index) => ({ item, index }))
    : visibleArrayEntries(rawItems, props, 'items')

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  if (visibleItems.length === 0 && !showTitle) {
    return (
      <section className="py-16 sm:py-24 px-6 sm:px-12 max-w-3xl mx-auto" style={{ backgroundColor: style.bg_color || '#F9F9F5' }}>
        {showTitle && (
          <BuilderTextField
            fieldKey="title"
            blockId={blockId}
            blockProps={props}
            value={title ?? ''}
            as="h2"
            className="text-3xl sm:text-4xl font-semibold mb-12 sm:mb-16 text-center"
            style={{ fontFamily: style.font_heading, color: style.text_color || '#182E20' }}
            placeholder="Section title"
          />
        )}
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? undefined}
          message="Share milestones — when you started, how you grew, or steps in your process."
        />
      </section>
    )
  }

  const textColor = style.text_color || '#182E20'
  const bg = style.bg_color || '#F9F9F5'

  return (
    <section className="py-16 sm:py-24 px-6 sm:px-12 max-w-3xl mx-auto" style={{ backgroundColor: bg }}>
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className="text-3xl sm:text-4xl font-semibold mb-12 sm:mb-16 text-center"
          style={{ fontFamily: style.font_heading, color: textColor }}
          placeholder="Section title"
        />
      )}
      <div className="relative">
        <div className="absolute left-8 sm:left-10 top-2 bottom-2 w-px opacity-20" style={{ backgroundColor: textColor }} />
        <div className="space-y-10 sm:space-y-12">
          {visibleItems.map(({ item, index: i }) => {
            const showYear = !isNestedBlockFieldHidden(props, `items.${i}.year`)
            const showItemTitle = !isNestedBlockFieldHidden(props, `items.${i}.title`)
            const showDesc = !isNestedBlockFieldHidden(props, `items.${i}.desc`)

            return (
              <div key={i} className="flex gap-5 sm:gap-8 items-start relative">
                {showYear && (
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shrink-0 z-10 text-center px-1 leading-tight"
                    style={{ backgroundColor: style.primary_color || '#274832' }}
                  >
                    {useReplacement ? (
                      sanitizeWellnessBodyCopy(item.year)
                    ) : (
                      <BuilderTextField
                        fieldKey={`items.${i}.year`}
                        blockId={blockId}
                        blockProps={props}
                        value={item.year}
                        as="span"
                        skipPositionWrapper
                        placeholder="2024"
                      />
                    )}
                  </div>
                )}
                <div className="pt-2 sm:pt-3 min-w-0">
                  {showItemTitle && (
                    useReplacement ? (
                      <h3
                        className="font-semibold text-lg sm:text-xl mb-2"
                        style={{ fontFamily: style.font_heading, color: textColor }}
                      >
                        {sanitizeWellnessBodyCopy(item.title)}
                      </h3>
                    ) : (
                      <BuilderTextField
                        fieldKey={`items.${i}.title`}
                        blockId={blockId}
                        blockProps={props}
                        value={item.title}
                        as="h3"
                        className="font-semibold text-lg sm:text-xl mb-2"
                        style={{ fontFamily: style.font_heading, color: textColor }}
                        placeholder="Milestone title"
                      />
                    )
                  )}
                  {showDesc && (
                    useReplacement ? (
                      <p className="text-sm sm:text-base leading-relaxed opacity-75" style={{ color: textColor }}>
                        {sanitizeWellnessBodyCopy(item.desc)}
                      </p>
                    ) : (
                      <BuilderTextField
                        fieldKey={`items.${i}.desc`}
                        blockId={blockId}
                        blockProps={props}
                        value={item.desc}
                        as="p"
                        multiline
                        className="text-sm sm:text-base leading-relaxed opacity-75"
                        style={{ color: textColor }}
                        placeholder="Description"
                      />
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
