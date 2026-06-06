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
  onSelect,
}: {
  def: SectionBlockDef
  option: SectionLayoutOption
  categoryId: string
  optionIndex: number
  isActive?: boolean
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
      className={cn(
        'text-left rounded-xl border-2 bg-white overflow-hidden transition-all group',
        isActive
          ? 'border-orange-500 shadow-lg ring-2 ring-orange-500/25'
          : 'border-gray-200 hover:border-primary/50 hover:shadow-lg hover:ring-2 hover:ring-primary/15',
      )}
    >
      <div className="relative aspect-[4/3] bg-slate-100 border-b border-gray-100 overflow-hidden">
        {isCommerceBlock ? (
          <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
        ) : (
          <div className="absolute inset-2 rounded-md border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
            {def.type === 'footer' && (
              <div className="flex-1 min-h-0 bg-gradient-to-b from-slate-50 to-white p-1 space-y-0.5">
                <div className="h-1.5 w-1/3 mx-auto rounded bg-slate-200" />
                <div className="h-6 rounded bg-slate-100/80" />
                <div className="flex-1 rounded bg-slate-50" />
              </div>
            )}
            {def.type === 'nav' && (
              <>
                <div className="shrink-0 min-h-[22%]">
                  <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
                </div>
                <div className="flex-1 min-h-0 bg-gradient-to-b from-white to-slate-50 p-1">
                  <div className="h-2 w-1/2 mx-auto rounded bg-slate-200 mb-1" />
                  <div className="h-full rounded bg-slate-100/60" />
                </div>
              </>
            )}
            {def.type !== 'nav' && (
              <div className={cn(
                def.type === 'footer' ? 'mt-auto shrink-0 min-h-[38%]' : 'flex-1 min-h-0',
              )}>
                <SectionLayoutPreview blockType={def.type} variantProps={merged} sampleUrls={sampleUrls} />
              </div>
            )}
          </div>
        )}
        <div className={cn(
          'absolute top-3 transition-opacity',
          isActive ? 'left-3 opacity-100' : 'right-3 opacity-0 group-hover:opacity-100',
        )}>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full shadow',
            isActive ? 'bg-orange-500 text-white' : 'bg-primary text-white',
          )}>
            {isActive ? 'Current layout' : 'Use this layout'}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-gray-800">{option.label}</div>
        {option.desc && <div className="text-xs text-gray-500 mt-0.5 leading-snug">{option.desc}</div>}
        {usesImages && sampleUrls.length > 0 && (
          <div className="text-[10px] text-primary/80 mt-1.5 font-medium">Preview uses selected category images</div>
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
  onSelect: (propsOverride: Partial<BlockProps>, imageCategoryId: string) => void
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
  const Icon = def.icon
  const categories = listImageCategoryOptions()
  const activeCategory = categories.find(c => c.id === imageCategoryId)

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(c =>
      c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    )
  }, [categories, categorySearch])

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="section-layout-picker-title"
        >
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 bg-gray-900 text-white shrink-0">
            <div>
              <h2 id="section-layout-picker-title" className="text-lg font-bold">Choose layout</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {blockSupportsGalleryCategory(def.type)
                  ? 'Preview uses images from your selected category'
                  : `${options.length} layout styles — pick the look that fits your page`}
              </p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col hidden md:flex">
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-white leading-tight">{def.label}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{def.desc}</p>
              </div>

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

            <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
              <div className="shrink-0 p-4 sm:px-5 sm:pt-5 sm:pb-2 space-y-3">
                <div className="md:hidden space-y-2">
                  <p className="text-xs font-medium text-gray-600">{def.label}</p>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">Image category</label>
                  <select
                    value={imageCategoryId}
                    onChange={e => setImageCategoryId(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-600">
                    More layouts ({options.length} total)
                  </p>
                  {options.length > 6 && (
                    <p className="text-[10px] text-gray-400 shrink-0">Scroll for more</p>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 pb-4 sm:pb-5 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {options.map((opt, idx) => (
                    <LayoutOptionCard
                      key={opt.id}
                      def={def}
                      option={opt}
                      categoryId={imageCategoryId}
                      optionIndex={idx}
                      isActive={activeOptionId === opt.id}
                      onSelect={() => onSelect(opt.props as Partial<BlockProps>, imageCategoryId)}
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
