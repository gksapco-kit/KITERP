import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn } from '@/lib/utils'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function StatsBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId

  const title = resolveBlockTextField(props, 'title')
  const surface = resolveSectionSurface(props, style)
  const columns = columnsFromProps(props)
  const itemGap = sectionItemGap(props, 32)
  const cardStyle = String(props.card_style ?? '')
  const showDividers = props.show_dividers === true

  const staticStats = (props.stats as Array<{ value: string; label: string }> | undefined) || []
  const useLive = liveItems.length > 0
  const visibleStatic = visibleArrayEntries(staticStats, props, 'stats')

  const items = useLive
    ? liveItems.map((item, i) => ({
        value: item.title,
        label: item.subtitle || '',
        index: i,
        fromProps: false,
      }))
    : visibleStatic.map(({ item, index }) => ({
        value: item.value,
        label: item.label,
        index,
        fromProps: true,
      }))

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  if (items.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {showTitle && (
          <BuilderTextField
            fieldKey="title"
            blockId={blockId}
            blockProps={props}
            value={title ?? ''}
            as="h2"
            className="text-3xl font-bold mb-10 text-center"
            placeholder="Section title"
          />
        )}
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? 'Your highlights'}
          message="Add stats like happy customers, products sold, or years in business — or connect live store data."
        />
      </section>
    )
  }

  const colClass = sectionGridColumnClass(columns)

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className="text-3xl font-bold mb-10 text-center"
          placeholder="Section title"
        />
      )}
      <div className={cn('grid grid-cols-2 text-center', colClass, showDividers && 'divide-x divide-white/10')} style={{ gap: itemGap }}>
        {items.map((stat, i) => {
          const showValue = stat.fromProps
            ? !isNestedBlockFieldHidden(props, `stats.${stat.index}.value`)
            : true
          const showLabel = stat.fromProps
            ? !isNestedBlockFieldHidden(props, `stats.${stat.index}.label`)
            : true
          if (!showValue && !showLabel && !isEditorCanvas) return null

          return (
          <div
            key={i}
            className={cn(
              cardStyle === 'card' && 'builder-tile-card p-6 rounded-2xl border',
              surface.isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white/80',
            )}
          >
            {showValue && (
              <div className="text-4xl font-bold mb-2" style={{ color: surface.isDark ? '#fff' : style.primary_color }}>
                {stat.fromProps && blockId ? (
                  <BuilderTextField
                    fieldKey={`stats.${stat.index}.value`}
                    blockId={blockId}
                    blockProps={props}
                    value={stat.value}
                    as="span"
                    className="inline"
                    skipPositionWrapper
                    placeholder="0"
                  />
                ) : stat.value}
              </div>
            )}
            {showLabel && (
              <div className={cn('text-sm font-medium', surface.isDark ? 'text-white/70' : 'text-gray-500')}>
                {stat.fromProps && blockId ? (
                  <BuilderTextField
                    fieldKey={`stats.${stat.index}.label`}
                    blockId={blockId}
                    blockProps={props}
                    value={stat.label}
                    as="span"
                    className="inline"
                    skipPositionWrapper
                    placeholder="Label"
                  />
                ) : stat.label}
              </div>
            )}
          </div>
          )
        })}
      </div>
    </section>
  )
}
