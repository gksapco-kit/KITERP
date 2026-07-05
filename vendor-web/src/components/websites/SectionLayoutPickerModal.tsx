import { useMemo, useState, type ElementType } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { cn } from '@/lib/utils'
import {
  categoriesInGroup,
  IMAGE_CATEGORY_GROUPS,
} from '@/data/businessImagePack'
import {
  blockSupportsGalleryCategory,
  listImageCategoryOptions,
  pickGalleryImageUrls,
} from '@/lib/blockGalleryImages'
import { findActiveSectionLayoutOption, getSectionLayoutOptions, type SectionLayoutOption } from '@/lib/sectionLayoutPresets'
import {
  initialLayoutPickerDataSourceChoice,
  type LayoutPickerDataSourceChoice,
} from '@/lib/blockDataSources'
import { SectionLayoutPreview } from '@/components/websites/SectionLayoutPreview'
import type { BlockProps } from '@/types/websites'

export interface SectionBlockDef {
  type: string
  label: string
  desc: string
  category: string
  defaultProps: BlockProps
  icon: ElementType
}

function LayoutOptionCard({
  def,
  option,
  categoryId,
  optionIndex,
  isActive,
  compact,
  onSelect,
}: {
  def: SectionBlockDef
  option: SectionLayoutOption
  categoryId: string
  optionIndex: number
  isActive?: boolean
  compact?: boolean
  onSelect: () => void
}) {
  const merged = useMemo(
    () => ({ ...def.defaultProps, ...option.props } as Record<string, unknown>),
    [def.defaultProps, option.props],
  )
  const usesImages = blockSupportsGalleryCategory(def.type)
  const isCommerceBlock = def.type.includes('.')
  const sampleUrls = useMemo(() => {
    if (!usesImages) return []
    const pool = pickGalleryImageUrls(categoryId, 10)
    if (pool.length === 0) return []
    const start = optionIndex % pool.length
    return Array.from({ length: 8 }, (_, i) => pool[(start + i) % pool.length] ?? pool[0])
  }, [usesImages, categoryId, optionIndex])

  return (
    <button
      type="button"
      onClick={onSelect}
      title={option.desc || option.label}
      className={cn(
        'text-left border-2 bg-white overflow-hidden transition-all group',
        compact ? 'rounded-lg' : 'rounded-xl',
        isActive
          ? 'border-orange-500 shadow-lg ring-2 ring-orange-500/25'
          : 'border-gray-200 hover:border-primary/50 hover:shadow-lg hover:ring-2 hover:ring-primary/15',
      )}
    >
      <div className={cn(
        'relative bg-slate-100 border-b border-gray-100 overflow-hidden',
        compact ? 'h-[4.25rem]' : 'aspect-[4/3]',
      )}>
        {isCommerceBlock ? (
          <div className="absolute inset-0">
            <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
          </div>
        ) : (
          <div className={cn(
            'absolute rounded-md border border-border/80 bg-white shadow-sm overflow-hidden flex flex-col',
            compact ? 'inset-1' : 'inset-2',
          )}>
            {def.type === 'footer' && (
              compact ? (
                <div className="h-full flex items-end">
                  <div className="w-full shrink-0">
                    <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0 bg-gradient-to-b from-slate-50 to-white p-1 space-y-0.5">
                    <div className="h-1.5 w-1/3 mx-auto rounded bg-slate-200" />
                    <div className="h-6 rounded bg-slate-100/80" />
                    <div className="flex-1 rounded bg-slate-50" />
                  </div>
                  <div className="mt-auto shrink-0 min-h-[38%] relative">
                    <div className="absolute inset-0">
                      <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
                    </div>
                  </div>
                </>
              )
            )}
            {def.type === 'nav' && (
              compact ? (
                <div className="h-full flex items-start">
                  <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
                </div>
              ) : (
                <>
                  <div className="shrink-0 min-h-[22%]">
                    <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
                  </div>
                  <div className="flex-1 min-h-0 bg-gradient-to-b from-white to-slate-50 p-1">
                    <div className="h-2 w-1/2 mx-auto rounded bg-slate-200 mb-1" />
                    <div className="h-full rounded bg-slate-100/60" />
                  </div>
                </>
              )
            )}
            {def.type !== 'nav' && def.type !== 'footer' && (
              <div className="flex-1 min-h-0 relative">
                <div className="absolute inset-0">
                  <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
                </div>
              </div>
            )}
          </div>
        )}
        <div className={cn(
          'absolute transition-opacity',
          compact ? 'top-1.5' : 'top-3',
          isActive ? 'left-1.5 opacity-100' : 'right-1.5 opacity-0 group-hover:opacity-100',
        )}>
          <span className={cn(
            'font-semibold rounded-full shadow',
            compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
            isActive ? 'bg-orange-500 text-white' : 'bg-primary text-white',
          )}>
            {isActive ? 'Current' : 'Use'}
          </span>
        </div>
      </div>
      <div className={compact ? 'px-2 py-1.5' : 'p-2.5'}>
        <div className={cn(
          'font-semibold text-gray-800 leading-tight',
          compact ? 'text-[11px] line-clamp-1' : 'text-sm',
        )}>
          {option.label}
        </div>
        {!compact && option.desc && (
          <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{option.desc}</div>
        )}
        {!compact && usesImages && sampleUrls.length > 0 && (
          <div className="text-[10px] text-primary/80 mt-1 font-medium">Uses category preview images</div>
        )}
      </div>
    </button>
  )
}

export function SectionLayoutPickerModal({
  def,
  defaultImageCategoryId,
  currentProps,
  onSelect,
  onClose,
}: {
  def: SectionBlockDef
  defaultImageCategoryId: string
  currentProps?: Record<string, unknown>
  onSelect: (propsOverride: Partial<BlockProps>, imageCategoryId: string, dataSourceChoice: LayoutPickerDataSourceChoice) => void
  onClose: () => void
}) {
  useEscapeToClose(onClose)
  const options = useMemo(() => getSectionLayoutOptions(def.type), [def.type])
  const activeOptionId = useMemo(
    () => findActiveSectionLayoutOption(currentProps, options)?.id,
    [currentProps, options],
  )
  const [imageCategoryId, setImageCategoryId] = useState(defaultImageCategoryId)
  const [categorySearch, setCategorySearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(IMAGE_CATEGORY_GROUPS.slice(0, 1)))
  const dataSourceChoice = useMemo(
    () => initialLayoutPickerDataSourceChoice(def.type, currentProps),
    [def.type, currentProps],
  )
  const Icon = def.icon
  const showGallerySidebar = blockSupportsGalleryCategory(def.type)
  const categories = listImageCategoryOptions()
  const activeCategory = categories.find(c => c.id === imageCategoryId)

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(c =>
      c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    )
  }, [categories, categorySearch])

  const headerSubtitle = showGallerySidebar
    ? `${def.label} · ${options.length} layouts · preview uses your selected image category`
    : `${def.label} · ${options.length} layouts · ${def.desc}`
  const useCompactGrid = options.length >= 8 || def.type === 'nav' || def.type === 'footer'

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 pointer-events-none overflow-y-auto">
        <div
          className={cn(
            'pointer-events-auto w-full bg-card border border-border text-foreground rounded-2xl shadow-2xl flex flex-col my-auto',
            useCompactGrid ? 'max-w-6xl' : showGallerySidebar ? 'max-w-5xl' : 'max-w-4xl',
            useCompactGrid ? '' : 'max-h-[90vh] overflow-hidden',
          )}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="section-layout-picker-title"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 text-white shrink-0">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 id="section-layout-picker-title" className="text-base font-bold leading-tight">Choose section style</h2>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{headerSubtitle}</p>
              </div>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={cn('flex', useCompactGrid ? '' : 'flex-1 min-h-0')}>
            {showGallerySidebar && (
            <div className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col hidden md:flex">
              <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-0.5">Image gallery category</p>
                <div className="relative shrink-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                  <input
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    placeholder="Search categories…"
                    className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                  {categorySearch.trim() ? (
                    filteredCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setImageCategoryId(cat.id)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors',
                          imageCategoryId === cat.id ? 'bg-orange-500/20 text-orange-400 font-semibold' : 'text-gray-300 hover:bg-white/5',
                        )}
                      >
                        {cat.label}
                      </button>
                    ))
                  ) : (
                    IMAGE_CATEGORY_GROUPS.map(group => {
                      const groupCats = categoriesInGroup(group)
                      const expanded = expandedGroups.has(group)
                      return (
                        <div key={group} className="rounded-lg border border-gray-800 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedGroups(prev => {
                              const next = new Set(prev)
                              if (next.has(group)) next.delete(group)
                              else next.add(group)
                              return next
                            })}
                            className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 hover:bg-white/5"
                          >
                            {group}
                            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
                          </button>
                          {expanded && (
                            <div className="pb-1">
                              {groupCats.map(cat => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setImageCategoryId(cat.id)}
                                  className={cn(
                                    'w-full text-left px-2.5 py-1 text-xs transition-colors',
                                    imageCategoryId === cat.id ? 'bg-orange-500/20 text-orange-400 font-semibold' : 'text-gray-300 hover:bg-white/5',
                                  )}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                {activeCategory && (
                  <p className="text-[10px] text-gray-500 leading-snug shrink-0 px-0.5">{activeCategory.description}</p>
                )}
              </div>
            </div>
            )}

            <div className={cn('flex-1 flex flex-col bg-gray-50', useCompactGrid ? '' : 'min-h-0')}>
              {showGallerySidebar && (
              <div className="shrink-0 px-4 pt-3 pb-1 md:hidden">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Image category</label>
                <select
                  value={imageCategoryId}
                  onChange={e => setImageCategoryId(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              )}
              <div className={cn(
                'px-3 sm:px-4 py-3',
                useCompactGrid ? '' : 'flex-1 min-h-0 overflow-y-auto overscroll-contain',
              )}>
                <div className={cn(
                  'grid gap-2',
                  useCompactGrid
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'
                    : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5',
                )}>
                  {options.map((opt, idx) => (
                    <LayoutOptionCard
                      key={opt.id}
                      def={def}
                      option={opt}
                      categoryId={imageCategoryId}
                      optionIndex={idx}
                      isActive={activeOptionId === opt.id}
                      compact={useCompactGrid}
                      onSelect={() => onSelect(opt.props as Partial<BlockProps>, imageCategoryId, dataSourceChoice)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
