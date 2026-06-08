import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import {
  genericTimelineContent,
  isTemplateTimelineBlock,
  sanitizeWellnessBodyCopy,
} from '@/lib/wellnessTemplateCopy'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function TimelineBlock({ site, style, props }: Props) {
  const useReplacement = isTemplateTimelineBlock(props)
  const replacement = useReplacement ? genericTimelineContent(site.name) : null

  const title = sanitizeWellnessBodyCopy(
    (useReplacement ? replacement?.title : (props.title as string)) || 'Our Journey',
  )
  const items = useReplacement && replacement
    ? replacement.items
    : ((props.items as Array<{ year: string; title: string; desc: string }> | undefined) || [])

  if (items.length === 0) {
    return (
      <section className="py-16 sm:py-24 px-6 sm:px-12 max-w-3xl mx-auto" style={{ backgroundColor: style.bg_color || '#F9F9F5' }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title || 'Our story'}
          message="Share milestones — when you started, how you grew, or steps in your process."
        />
      </section>
    )
  }

  const textColor = style.text_color || '#182E20'
  const bg = style.bg_color || '#F9F9F5'

  return (
    <section className="py-16 sm:py-24 px-6 sm:px-12 max-w-3xl mx-auto" style={{ backgroundColor: bg }}>
      {title && (
        <h2
          className="text-3xl sm:text-4xl font-semibold mb-12 sm:mb-16 text-center"
          style={{ fontFamily: style.font_heading, color: textColor }}
        >
          {title}
        </h2>
      )}
      <div className="relative">
        <div className="absolute left-8 sm:left-10 top-2 bottom-2 w-px opacity-20" style={{ backgroundColor: textColor }} />
        <div className="space-y-10 sm:space-y-12">
          {items.map((item, i) => (
            <div key={i} className="flex gap-5 sm:gap-8 items-start relative">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shrink-0 z-10 text-center px-1 leading-tight"
                style={{ backgroundColor: style.primary_color || '#274832' }}
              >
                {sanitizeWellnessBodyCopy(item.year)}
              </div>
              <div className="pt-2 sm:pt-3 min-w-0">
                <h3
                  className="font-semibold text-lg sm:text-xl mb-2"
                  style={{ fontFamily: style.font_heading, color: textColor }}
                >
                  {sanitizeWellnessBodyCopy(item.title)}
                </h3>
                <p className="text-sm sm:text-base leading-relaxed opacity-75" style={{ color: textColor }}>
                  {sanitizeWellnessBodyCopy(item.desc)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
