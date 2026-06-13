import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import {
  Search, X,
  Layout, FileText, Sparkles, Image as ImageIcon, Globe,
  Undo2, Redo2, Save, Eye, Monitor, Tablet, Smartphone,
  ZoomIn, ZoomOut, Maximize2, Palette, SlidersHorizontal,
  Trash2, Copy, Layers, Database, Lightbulb, BookOpen, Mail,
  ChevronRight, Plus, Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types passed in from Builder ─────────────────────────────────────── */
export interface CommandPaletteBlock {
  id: string
  label: string
  blockType: string
}

export interface CommandPalettePage {
  id: string
  title: string
  slug: string
  is_homepage: boolean
}

export interface CommandPaletteBlockDef {
  type: string
  label: string
  desc: string
  category: string
  icon: React.ElementType
}

export interface BuilderCommandPaletteProps {
  open: boolean
  onClose: () => void

  /* canvas blocks on the current page */
  activeBlocks: CommandPaletteBlock[]

  /* all pages */
  pages: CommandPalettePage[]
  activePageId: string | null

  /* section catalog */
  blockCatalog: CommandPaletteBlockDef[]

  /* state */
  selectedBlockId: string | null
  canUndo: boolean
  canRedo: boolean
  device: 'desktop' | 'tablet' | 'mobile'

  /* action callbacks */
  onSelectBlock: (id: string) => void
  onNavigatePage: (id: string) => void
  onAddSection: (def: CommandPaletteBlockDef) => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onPreview: () => void
  onDuplicateBlock: (id: string) => void
  onDeleteBlock: (id: string) => void
  onDeselectBlock: () => void
  onSetDevice: (d: 'desktop' | 'tablet' | 'mobile') => void
  onSetZoom: (z: number) => void
  onFitZoom: () => void
  onOpenPanel: (panel: 'blocks' | 'pages' | 'templates' | 'media' | 'settings' | 'seo') => void
  onOpenRightPanel: (panel: 'props' | 'style' | 'data') => void
  onOpenHelp: () => void
}

/* ─── Fuzzy match ────────────────────────────────────────────────────────── */
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

/* ─── Command item types ─────────────────────────────────────────────────── */
type CommandGroup =
  | 'Go to section'
  | 'Go to page'
  | 'Add section'
  | 'Commands'
  | 'Open panel'
  | 'Device & zoom'
  | 'Help'

interface CommandItem {
  id: string
  group: CommandGroup
  label: string
  sublabel?: string
  icon: React.ElementType
  iconColor?: string
  shortcut?: string[]
  disabled?: boolean
  run: () => void
}

export function BuilderCommandPalette(props: BuilderCommandPaletteProps) {
  const {
    open, onClose,
    activeBlocks, pages, activePageId,
    blockCatalog,
    selectedBlockId, canUndo, canRedo, device,
    onSelectBlock, onNavigatePage, onAddSection,
    onUndo, onRedo, onSave, onPreview,
    onDuplicateBlock, onDeleteBlock, onDeselectBlock,
    onSetDevice, onSetZoom, onFitZoom,
    onOpenPanel, onOpenRightPanel, onOpenHelp,
  } = props

  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /* focus input when opened */
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  /* build full command list */
  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []

    /* Go to section (blocks on current page) */
    for (const b of activeBlocks) {
      items.push({
        id: `section:${b.id}`,
        group: 'Go to section',
        label: b.label,
        sublabel: b.blockType,
        icon: Layers,
        iconColor: 'text-violet-500',
        run: () => { onSelectBlock(b.id); onClose() },
      })
    }

    /* Go to page */
    for (const p of pages) {
      const isActive = p.id === activePageId
      items.push({
        id: `page:${p.id}`,
        group: 'Go to page',
        label: p.title + (p.is_homepage ? ' (Home)' : ''),
        sublabel: '/' + p.slug,
        icon: FileText,
        iconColor: isActive ? 'text-primary' : 'text-blue-500',
        disabled: isActive,
        run: () => { if (!isActive) { onNavigatePage(p.id); onClose() } },
      })
    }

    /* Add section — from catalog */
    for (const def of blockCatalog) {
      items.push({
        id: `add:${def.type}`,
        group: 'Add section',
        label: def.label,
        sublabel: def.desc,
        icon: def.icon ?? Plus,
        iconColor: 'text-emerald-500',
        run: () => { onAddSection(def); onClose() },
      })
    }

    /* Commands */
    items.push({
      id: 'cmd:undo',
      group: 'Commands',
      label: 'Undo',
      icon: Undo2,
      shortcut: ['⌘', 'Z'],
      disabled: !canUndo,
      run: () => { onUndo(); onClose() },
    })
    items.push({
      id: 'cmd:redo',
      group: 'Commands',
      label: 'Redo',
      icon: Undo2,
      shortcut: ['⌘', 'Y'],
      disabled: !canRedo,
      run: () => { onRedo(); onClose() },
    })
    items.push({
      id: 'cmd:save',
      group: 'Commands',
      label: 'Save changes',
      icon: Save,
      shortcut: ['⌘', 'S'],
      run: () => { onSave(); onClose() },
    })
    items.push({
      id: 'cmd:preview',
      group: 'Commands',
      label: 'Preview site',
      icon: Eye,
      run: () => { onPreview(); onClose() },
    })
    if (selectedBlockId) {
      items.push({
        id: 'cmd:duplicate',
        group: 'Commands',
        label: 'Duplicate selected section',
        icon: Copy,
        shortcut: ['⌘', 'D'],
        run: () => { onDuplicateBlock(selectedBlockId); onClose() },
      })
      items.push({
        id: 'cmd:delete',
        group: 'Commands',
        label: 'Delete selected section',
        icon: Trash2,
        iconColor: 'text-red-500',
        run: () => { onDeleteBlock(selectedBlockId); onClose() },
      })
      items.push({
        id: 'cmd:deselect',
        group: 'Commands',
        label: 'Deselect section',
        icon: X,
        shortcut: ['Esc'],
        run: () => { onDeselectBlock(); onClose() },
      })
    }

    /* Open panel */
    const panels: { id: Parameters<typeof onOpenPanel>[0]; label: string; icon: React.ElementType; color: string }[] = [
      { id: 'blocks', label: 'Sections panel', icon: Layout, color: 'text-indigo-500' },
      { id: 'pages', label: 'Pages panel', icon: FileText, color: 'text-blue-500' },
      { id: 'templates', label: 'Templates panel', icon: Sparkles, color: 'text-amber-500' },
      { id: 'media', label: 'Media panel', icon: ImageIcon, color: 'text-pink-500' },
      { id: 'settings', label: 'Site settings', icon: Globe, color: 'text-teal-500' },
      { id: 'seo', label: 'SEO panel', icon: Search, color: 'text-orange-500' },
    ]
    for (const p of panels) {
      items.push({
        id: `panel:${p.id}`,
        group: 'Open panel',
        label: p.label,
        icon: p.icon,
        iconColor: p.color,
        run: () => { onOpenPanel(p.id); onClose() },
      })
    }
    items.push({
      id: 'panel:style',
      group: 'Open panel',
      label: 'Style settings',
      icon: Palette,
      iconColor: 'text-rose-500',
      run: () => { onOpenRightPanel('style'); onClose() },
    })
    items.push({
      id: 'panel:data',
      group: 'Open panel',
      label: 'Data / Store connection',
      icon: Database,
      iconColor: 'text-cyan-500',
      run: () => { onOpenRightPanel('data'); onClose() },
    })
    items.push({
      id: 'panel:props',
      group: 'Open panel',
      label: 'Section properties',
      icon: Settings2,
      iconColor: 'text-gray-500',
      run: () => { onOpenRightPanel('props'); onClose() },
    })

    /* Device & zoom */
    const devices: { mode: 'desktop' | 'tablet' | 'mobile'; label: string; icon: React.ElementType }[] = [
      { mode: 'desktop', label: 'Desktop view', icon: Monitor },
      { mode: 'tablet', label: 'Tablet view', icon: Tablet },
      { mode: 'mobile', label: 'Phone view', icon: Smartphone },
    ]
    for (const d of devices) {
      items.push({
        id: `device:${d.mode}`,
        group: 'Device & zoom',
        label: d.label,
        icon: d.icon,
        iconColor: device === d.mode ? 'text-primary' : 'text-gray-500',
        disabled: device === d.mode,
        run: () => { onSetDevice(d.mode); onClose() },
      })
    }
    items.push({ id: 'zoom:50', group: 'Device & zoom', label: 'Zoom 50%', icon: ZoomOut, run: () => { onSetZoom(0.5); onClose() } })
    items.push({ id: 'zoom:100', group: 'Device & zoom', label: 'Zoom 100%', icon: Maximize2, run: () => { onSetZoom(1); onClose() } })
    items.push({ id: 'zoom:125', group: 'Device & zoom', label: 'Zoom 125%', icon: ZoomIn, run: () => { onSetZoom(1.25); onClose() } })
    items.push({ id: 'zoom:150', group: 'Device & zoom', label: 'Zoom 150%', icon: ZoomIn, run: () => { onSetZoom(1.5); onClose() } })
    items.push({ id: 'zoom:fit', group: 'Device & zoom', label: 'Fit width', icon: Maximize2, run: () => { onFitZoom(); onClose() } })

    /* Help */
    items.push({
      id: 'help:tips',
      group: 'Help',
      label: 'Show builder tips',
      icon: Lightbulb,
      iconColor: 'text-yellow-500',
      run: () => { onOpenHelp(); onClose() },
    })
    items.push({
      id: 'help:docs',
      group: 'Help',
      label: 'Help documentation',
      icon: BookOpen,
      iconColor: 'text-blue-400',
      run: () => { window.open('https://help.kiterp.com', '_blank'); onClose() },
    })
    items.push({
      id: 'help:contact',
      group: 'Help',
      label: 'Contact support',
      icon: Mail,
      iconColor: 'text-green-500',
      run: () => { window.open('mailto:support@kiterp.com', '_blank'); onClose() },
    })

    return items
  }, [
    activeBlocks, pages, activePageId, blockCatalog,
    selectedBlockId, canUndo, canRedo, device,
    onSelectBlock, onNavigatePage, onAddSection,
    onUndo, onRedo, onSave, onPreview,
    onDuplicateBlock, onDeleteBlock, onDeselectBlock,
    onSetDevice, onSetZoom, onFitZoom,
    onOpenPanel, onOpenRightPanel, onOpenHelp, onClose,
  ])

  /* filter */
  const filtered = useMemo(() => {
    if (!query.trim()) {
      /* default state: show top picks across all groups */
      const topPicks: CommandItem[] = []
      const wantGroups: CommandGroup[] = ['Commands', 'Open panel', 'Go to section', 'Add section']
      for (const g of wantGroups) {
        const group = allCommands.filter(c => c.group === g)
        topPicks.push(...group.slice(0, g === 'Add section' ? 3 : group.length))
      }
      return topPicks
    }
    return allCommands.filter(c =>
      fuzzyMatch(c.label, query) ||
      (c.sublabel && fuzzyMatch(c.sublabel, query)) ||
      fuzzyMatch(c.group, query),
    )
  }, [query, allCommands])

  /* grouped view */
  const grouped = useMemo(() => {
    const map = new Map<CommandGroup, CommandItem[]>()
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return map
  }, [filtered])

  /* flat ordered list for keyboard nav */
  const flat = useMemo(() => filtered, [filtered])

  /* keyboard navigation */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[cursor]
      if (item && !item.disabled) item.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [flat, cursor, onClose])

  /* scroll active item into view */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  /* reset cursor when results change */
  useEffect(() => { setCursor(0) }, [filtered])

  /* register with the app-wide escape registry so Esc routes here first */
  useEffect(() => {
    if (!open) return
    return registerEscapeHandler(onClose)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[500] bg-black/30 backdrop-blur-[2px]"
        onMouseDown={onClose}
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 top-[10%] z-[501] w-full max-w-xl -translate-x-1/2 rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-3 py-2.5">
          <Search className="w-4 h-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sections, pages, commands…"
            className="flex-1 bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              title="Clear search"
              className="p-0.5 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="ml-1 shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto py-1.5">
          {flat.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No results for "{query}"</div>
          ) : (
            Array.from(grouped.entries()).map(([group, items]) => {
              const groupStart = flat.indexOf(items[0])
              return (
                <div key={group}>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {group}
                  </div>
                  {items.map((item, localIdx) => {
                    const globalIdx = groupStart + localIdx
                    const Icon = item.icon
                    const isActive = cursor === globalIdx
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-idx={globalIdx}
                        disabled={item.disabled}
                        onClick={() => !item.disabled && item.run()}
                        onMouseEnter={() => setCursor(globalIdx)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                          isActive && !item.disabled ? 'bg-primary/8 text-gray-900' : 'text-gray-700',
                          item.disabled ? 'opacity-40 cursor-default' : 'hover:bg-gray-50 cursor-pointer',
                        )}
                      >
                        <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', isActive && !item.disabled ? 'bg-primary/12' : 'bg-gray-100')}>
                          <Icon className={cn('w-3 h-3', item.iconColor ?? 'text-gray-500')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold leading-snug truncate">{item.label}</div>
                          {item.sublabel && (
                            <div className="text-[10px] text-gray-400 truncate leading-snug">{item.sublabel}</div>
                          )}
                        </div>
                        {item.shortcut && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            {item.shortcut.map(k => (
                              <kbd
                                key={k}
                                className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5 text-[9px] font-semibold text-gray-500"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        )}
                        {isActive && !item.disabled && (
                          <ChevronRight className="w-3 h-3 shrink-0 text-primary/60" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-3 py-1.5">
          <span className="text-[10px] text-gray-400">
            <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[9px] font-semibold text-gray-500 mr-0.5">↑↓</kbd>
            navigate
          </span>
          <span className="text-[10px] text-gray-400">
            <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[9px] font-semibold text-gray-500 mr-0.5">↵</kbd>
            run
          </span>
          <span className="text-[10px] text-gray-400">
            <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[9px] font-semibold text-gray-500 mr-0.5">Esc</kbd>
            close
          </span>
          <span className="ml-auto text-[10px] text-gray-300">{flat.length} result{flat.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </>,
    document.body,
  )
}
