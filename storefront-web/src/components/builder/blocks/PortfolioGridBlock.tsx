import { useMemo, useState } from 'react'
import { ExternalLink, Camera } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn, imgUrl } from '@/lib/utils'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

interface ProjectItem {
  title?: string
  category?: string
  image_url?: string
  url?: string
}

interface ProjectEntry {
  item: ProjectItem
  index?: number
  editable: boolean
}

function ProjectCard({
  entry,
  style,
  dark,
  hoverReveal,
  blockId,
  blockProps,
  aspect = 'aspect-[4/3]',
}: {
  entry: ProjectEntry
  style: StyleConfig
  dark?: boolean
  hoverReveal?: boolean
  blockId?: string
  blockProps?: Record<string, unknown>
  aspect?: string
}) {
  const { item, index, editable } = entry
  const i = index
  const showTitle = i == null || !blockProps || !isNestedBlockFieldHidden(blockProps, `projects.${i}.title`)
  const showCategory = i == null || !blockProps || !isNestedBlockFieldHidden(blockProps, `projects.${i}.category`)
  const resolvedImg = item.image_url ? imgUrl(item.image_url) : undefined

  const caption = (
    <div className={cn('min-w-0', hoverReveal ? 'text-white' : dark ? 'text-white' : 'text-gray-900')}>
      {showTitle && (
        editable && blockId && blockProps && i != null ? (
          <BuilderTextField
            fieldKey={`projects.${i}.title`}
            blockId={blockId}
            blockProps={blockProps}
            value={item.title ?? ''}
            as="p"
            skipPositionWrapper
            className="font-semibold text-sm truncate"
            placeholder="Project title"
          />
        ) : item.title ? <p className="font-semibold text-sm truncate">{item.title}</p> : null
      )}
      {showCategory && (
        editable && blockId && blockProps && i != null ? (
          <BuilderTextField
            fieldKey={`projects.${i}.category`}
            blockId={blockId}
            blockProps={blockProps}
            value={item.category ?? ''}
            as="p"
            skipPositionWrapper
            className={cn('text-xs truncate', hoverReveal ? 'text-white/70' : dark ? 'text-white/60' : 'text-gray-500')}
            placeholder="Category"
          />
        ) : item.category ? (
          <p className={cn('text-xs truncate', dark ? 'text-white/60' : 'text-gray-500')}>{item.category}</p>
        ) : null
      )}
    </div>
  )

  const imageEl = resolvedImg ? (
    editable && blockId && blockProps && i != null ? (
      <BuilderSectionImage
        blockId={blockId}
        field="image_url"
        arrayKey="projects"
        index={i}
        itemField="image_url"
        blockProps={blockProps}
        src={resolvedImg}
        alt={item.title ?? ''}
        className="absolute inset-0 h-full w-full object-cover"
      />
    ) : (
      <img src={resolvedImg} alt={item.title ?? ''} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
    )
  ) : (
    <div className={cn('absolute inset-0 flex items-center justify-center', dark ? 'bg-white/5 text-white/20' : 'bg-gray-100 text-gray-300')}>
      <Camera className="w-8 h-8" />
    </div>
  )

  const card = (
    <div className={cn('group relative w-full overflow-hidden rounded-xl', aspect)}>
      {imageEl}
      {hoverReveal ? (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {caption}
        </div>
      ) : null}
      {item.url && !editable ? (
        <span className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <ExternalLink className="w-3.5 h-3.5 text-gray-700" />
        </span>
      ) : null}
    </div>
  )

  const wrapped = item.url && !editable ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
      {card}
    </a>
  ) : card

  if (hoverReveal) return wrapped

  return (
    <div className="flex flex-col gap-2 h-full w-full min-w-0">
      {wrapped}
      {caption}
    </div>
  )
}

function toProjectEntries(
  props: Record<string, unknown>,
  liveItems: LiveItem[],
): ProjectEntry[] {
  const staticProjects = Array.isArray(props.projects) ? (props.projects as ProjectItem[]) : []
  const staticVisible = visibleArrayEntries(staticProjects, props, 'projects')
    .filter(({ item }) => typeof item?.image_url === 'string' && item.image_url)

  if (staticVisible.length > 0) {
    return staticVisible.map(({ item, index }) => ({ item, index, editable: true }))
  }

  if (liveItems.length > 0) {
    return liveItems
      .filter(i => i.image_url)
      .map(i => ({
        item: { title: i.title, category: i.subtitle ?? undefined, image_url: i.image_url as string, url: i.url ?? undefined },
        editable: false,
      }))
  }

  return []
}

export default function PortfolioGridBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Our Work'),
  })
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const layout = String(props.layout ?? 'grid')
  const columns = columnsFromProps(props, layout === 'featured' ? 'grid-3' : layout)
  const itemGap = sectionItemGap(props, 24)
  const surface = resolveSectionSurface(props, style)
  const dark = surface.isDark
  const filterable = props.filterable === true
  const hoverReveal = props.hover_reveal === true

  const entries = toProjectEntries(props, liveItems)

  const [activeCategory, setActiveCategory] = useState<string>('All')
  const categories = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(({ item }) => { if (item.category) set.add(item.category) })
    return Array.from(set)
  }, [entries])

  const filteredEntries = filterable && activeCategory !== 'All'
    ? entries.filter(({ item }) => item.category === activeCategory)
    : entries

  if (entries.length === 0) {
    return (
      <div className="w-full" style={{ background: surface.background, color: surface.color }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? 'Our Work'}
          message="Add your projects to showcase your portfolio. Use the Content panel to add photos, titles, and categories."
          hint="You can also connect a live media category from your catalog."
          icon={<Camera className="w-10 h-10" style={{ color: style.primary_color }} />}
        />
      </div>
    )
  }

  const sectionTitle = showTitle ? (
    <BuilderTextField
      fieldKey="title"
      blockId={blockId}
      blockProps={props}
      value={title ?? ''}
      as="h2"
      className={cn('text-3xl font-bold mb-4 text-center', dark ? 'text-white' : 'text-gray-900')}
      placeholder="Section title"
    />
  ) : null

  const filterTabs = filterable && categories.length > 1 ? (
    <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
      {['All', ...categories].map(cat => (
        <button
          key={cat}
          type="button"
          onClick={() => setActiveCategory(cat)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
            activeCategory === cat
              ? 'text-white'
              : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
          style={activeCategory === cat ? { backgroundColor: style.primary_color } : undefined}
        >
          {cat}
        </button>
      ))}
    </div>
  ) : null

  const wrapperStyle = { background: surface.background, color: surface.color }

  // Full-bleed stacked rows — no inner max-width container, edge-to-edge photos.
  if (layout === 'full') {
    return (
      <div className="w-full" style={wrapperStyle}>
        {(sectionTitle || filterTabs) && (
          <div className={builderSectionContainerWithMax('max-w-6xl')}>
            {sectionTitle}
            {filterTabs}
          </div>
        )}
        <div className="flex flex-col gap-1">
          {filteredEntries.map((entry, i) => (
            <div key={i} className="relative w-full h-[280px] sm:h-[380px] overflow-hidden">
              <ProjectCard entry={entry} style={style} dark={dark} hoverReveal blockId={blockId} blockProps={props} aspect="h-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (layout === 'carousel') {
    return (
      <div className="w-full" style={wrapperStyle}>
        <section className={builderSectionContainerClass()}>
          {sectionTitle}
          {filterTabs}
          <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory" style={{ gap: itemGap }}>
            {filteredEntries.map((entry, i) => (
              <div key={i} className="snap-start shrink-0 w-72 min-w-[18rem] max-w-[18rem]">
                <ProjectCard entry={entry} style={style} dark={dark} hoverReveal={hoverReveal} blockId={blockId} blockProps={props} />
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (layout === 'list') {
    return (
      <div className="w-full" style={wrapperStyle}>
        <section className={builderSectionContainerWithMax('max-w-3xl')}>
          {sectionTitle}
          {filterTabs}
          <div className="space-y-3">
            {filteredEntries.map((entry, i) => {
              const { item, index, editable } = entry
              const resolvedImg = item.image_url ? imgUrl(item.image_url) : undefined
              const showItemTitle = index == null || !isNestedBlockFieldHidden(props, `projects.${index}.title`)
              const showItemCategory = index == null || !isNestedBlockFieldHidden(props, `projects.${index}.category`)
              const row = (
                <div className={cn('flex items-center gap-4 rounded-xl border p-3', dark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white')}>
                  <div className="relative w-20 h-16 shrink-0 overflow-hidden rounded-lg">
                    {resolvedImg ? (
                      editable && blockId && index != null ? (
                        <BuilderSectionImage
                          blockId={blockId}
                          field="image_url"
                          arrayKey="projects"
                          index={index}
                          itemField="image_url"
                          blockProps={props}
                          src={resolvedImg}
                          alt={item.title ?? ''}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <img src={resolvedImg} alt={item.title ?? ''} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      )
                    ) : (
                      <div className={cn('absolute inset-0 flex items-center justify-center', dark ? 'bg-white/5 text-white/20' : 'bg-gray-100 text-gray-300')}>
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {showItemTitle && (
                      editable && blockId && index != null ? (
                        <BuilderTextField fieldKey={`projects.${index}.title`} blockId={blockId} blockProps={props} value={item.title ?? ''} as="p" skipPositionWrapper className={cn('font-semibold text-sm truncate', dark && 'text-white')} placeholder="Project title" />
                      ) : item.title ? <p className={cn('font-semibold text-sm truncate', dark && 'text-white')}>{item.title}</p> : null
                    )}
                    {showItemCategory && (
                      editable && blockId && index != null ? (
                        <BuilderTextField fieldKey={`projects.${index}.category`} blockId={blockId} blockProps={props} value={item.category ?? ''} as="p" skipPositionWrapper className={cn('text-xs truncate', dark ? 'text-white/60' : 'text-gray-500')} placeholder="Category" />
                      ) : item.category ? <p className={cn('text-xs truncate', dark ? 'text-white/60' : 'text-gray-500')}>{item.category}</p> : null
                    )}
                  </div>
                  {item.url && !editable && <ExternalLink className={cn('w-4 h-4 shrink-0', dark ? 'text-white/40' : 'text-gray-400')} />}
                </div>
              )
              return item.url && !editable ? (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">{row}</a>
              ) : <div key={i}>{row}</div>
            })}
          </div>
        </section>
      </div>
    )
  }

  if (layout === 'featured' && filteredEntries.length > 0) {
    return (
      <div className="w-full" style={wrapperStyle}>
        <section className={builderSectionContainerClass()}>
          {sectionTitle}
          {filterTabs}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full min-h-[280px] overflow-hidden rounded-xl">
              <ProjectCard entry={filteredEntries[0]} style={style} dark={dark} hoverReveal blockId={blockId} blockProps={props} aspect="h-full" />
            </div>
            <div className={cn('grid gap-4', sectionGridColumnClass(2))}>
              {filteredEntries.slice(1, 5).map((entry, i) => (
                <ProjectCard key={i} entry={entry} style={style} dark={dark} hoverReveal={hoverReveal} blockId={blockId} blockProps={props} />
              ))}
            </div>
          </div>
          {filteredEntries.length > 5 && (
            <div className={cn('grid', sectionGridColumnClass(3))} style={{ gap: itemGap }}>
              {filteredEntries.slice(5).map((entry, i) => (
                <ProjectCard key={i} entry={entry} style={style} dark={dark} hoverReveal={hoverReveal} blockId={blockId} blockProps={props} />
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  if (layout === 'masonry') {
    return (
      <div className="w-full" style={wrapperStyle}>
        <section className={builderSectionContainerClass()}>
          {sectionTitle}
          {filterTabs}
          <div className={cn('gap-4 space-y-4', columns >= 4 ? 'columns-2 sm:columns-3 lg:columns-4' : 'columns-1 sm:columns-2 lg:columns-3')}>
            {filteredEntries.map((entry, i) => (
              <div key={i} className="break-inside-avoid mb-4">
                <ProjectCard entry={entry} style={style} dark={dark} hoverReveal={hoverReveal} blockId={blockId} blockProps={props} aspect="aspect-auto" />
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  // grid (default) — respects columns (2/3/4) + optional filter tabs + hover reveal
  return (
    <div className="w-full" style={wrapperStyle}>
      <section className={builderSectionContainerClass()}>
        {sectionTitle}
        {filterTabs}
        <div className={cn('grid', sectionGridColumnClass(columns))} style={{ gap: itemGap }}>
          {filteredEntries.map((entry, i) => (
            <ProjectCard
              key={i}
              entry={entry}
              style={style}
              dark={dark}
              hoverReveal={hoverReveal}
              blockId={blockId}
              blockProps={props}
              aspect={columns <= 2 ? 'aspect-[4/3]' : 'aspect-square'}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
