import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { hasInlineHtml } from '@/lib/fieldTextStyles'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { cn } from '@/lib/utils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function RichTextBlock({ props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const content = resolveBlockTextField(props, 'content')
  const showContent = !isBlockFieldHidden(props, 'content') && (content || isEditorCanvas)

  if (!showContent) return null

  const layout = String(props.layout ?? 'standard')
  const isNarrow = layout === 'narrow'
  const isWide = layout === 'wide'
  const isCentered = layout === 'centered'
  const isColumns = layout === 'columns'
  const isCard = layout === 'card' || props.card_style === 'elevated'
  const isQuote = layout === 'quote'
  const maxWidthProp = String(props.max_width ?? '')
  const align = String(props.align ?? (isCentered || isQuote ? 'center' : 'left'))
  const numColumns = isColumns && Number(props.columns) === 3 ? 3 : 2
  const isDark = props.bg_style === 'dark'

  const maxWidthClass =
    isNarrow || maxWidthProp === 'prose' ? 'max-w-2xl'
      : isWide ? 'max-w-6xl'
        : isColumns ? 'max-w-5xl'
          : 'max-w-4xl'

  const contentClass = cn(
    'rich-text-content max-w-none',
    content && !hasInlineHtml(content) && 'whitespace-pre-wrap',
    align === 'center' && 'text-center',
    isColumns && cn(numColumns === 3 ? 'md:columns-3' : 'md:columns-2', 'md:gap-10 [&>*]:break-inside-avoid-column'),
    isQuote && 'text-2xl sm:text-3xl font-serif italic leading-relaxed',
    isDark && 'text-white/90',
  )

  const shellClass = cn(
    isCard && 'rounded-2xl p-6 sm:p-8',
    isCard && (isDark ? 'border border-white/15 bg-white/5 shadow-none' : 'border border-gray-200 bg-white shadow-sm'),
  )

  const inner = blockId ? (
    <BuilderTextField
      fieldKey="content"
      blockId={blockId}
      blockProps={props}
      value={content ?? ''}
      as="div"
      multiline
      className={contentClass}
      placeholder="Add your content"
    />
  ) : (
    <div className={contentClass} dangerouslySetInnerHTML={{ __html: content ?? '' }} />
  )

  return (
    <div className="w-full" style={isDark ? { background: '#0f172a', color: '#f8fafc' } : undefined}>
      <section className={builderSectionContainerWithMax(maxWidthClass)}>
        {isQuote && (
          <span aria-hidden className={cn('block text-5xl leading-none mb-2 opacity-30', align === 'center' && 'text-center')}>
            &ldquo;
          </span>
        )}
        {isCard ? <div className={shellClass}>{inner}</div> : inner}
      </section>
    </div>
  )
}
