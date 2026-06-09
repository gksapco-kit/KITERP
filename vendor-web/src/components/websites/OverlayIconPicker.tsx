import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import {
  BUILDER_OVERLAY_ICONS,
  builderOverlayIconCategories,
  builderOverlayIconLabel,
  resolveBuilderOverlayIcon,
} from '@storefront/lib/builderOverlayIcons'
import { visualActionBtn, visualPanelCell } from '@/components/websites/designBarVisualUi'

export function OverlayIconPickerMenu({
  open,
  anchorRef,
  menuRef,
  value,
  onPick,
  headerAction,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  menuRef: RefObject<HTMLDivElement | null>
  value?: string | null
  onPick: (iconId: string) => void
  /** e.g. "Add to section" quick action at top of menu */
  headerAction?: { label: string; onClick: () => void }
}) {
  const iconId = value || 'star'
  const categories = builderOverlayIconCategories()

  return (
    <DesignBarDropdownPortal
      open={open}
      anchorRef={anchorRef}
      menuRef={menuRef}
      className="w-[min(18rem,92vw)] max-h-[min(20rem,70vh)] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-2xl"
    >
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-2.5 py-2">
        <div className="text-[11px] font-bold text-gray-800">Choose icon</div>
        <div className="text-[10px] text-gray-500">{BUILDER_OVERLAY_ICONS.length} icons</div>
        {headerAction ? (
          <button
            type="button"
            onClick={headerAction.onClick}
            className="mt-1.5 w-full rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/15"
          >
            {headerAction.label}
          </button>
        ) : null}
      </div>
      <div className="space-y-2 p-2">
        {categories.map(category => (
          <div key={category}>
            <div className="mb-1 px-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
              {category}
            </div>
            <div className="grid grid-cols-6 gap-1">
              {BUILDER_OVERLAY_ICONS.filter(entry => entry.category === category).map(entry => {
                const active = entry.id === iconId
                const Icon = entry.Icon
                return (
                  <button
                    key={entry.id}
                    type="button"
                    title={entry.label}
                    onClick={() => onPick(entry.id)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-md border transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-accent',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </DesignBarDropdownPortal>
  )
}

export function OverlayIconPicker({
  value,
  onChange,
  compact = false,
}: {
  value?: string | null
  onChange: (iconId: string) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const iconId = value || 'star'
  const CurrentIcon = resolveBuilderOverlayIcon(iconId)

  useEffect(() => {
    if (!open) return
    return registerEscapeHandler(() => setOpen(false))
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={`Icon: ${builderOverlayIconLabel(iconId)} — click to change`}
        onClick={() => setOpen(v => !v)}
        className={cn(
          compact ? cn(visualActionBtn('primary'), 'gap-1 px-1.5') : visualPanelCell,
          open && 'ring-1 ring-primary/40',
        )}
      >
        <CurrentIcon className="h-3.5 w-3.5 shrink-0" />
        {compact ? <span className="text-[8px] font-bold">Icon</span> : null}
      </button>

      <OverlayIconPickerMenu
        open={open}
        anchorRef={btnRef}
        menuRef={menuRef}
        value={iconId}
        onPick={id => {
          onChange(id)
          setOpen(false)
        }}
      />
    </>
  )
}

/** Ribbon “Icons” control — pick to add or replace an icon layer. */
export function OverlayIconsRibbonButton({
  selectedIconId,
  onPickIcon,
  active,
  btnRef: externalRef,
  open,
  onToggle,
}: {
  selectedIconId?: string | null
  onPickIcon: (iconId: string) => void
  active?: boolean
  btnRef?: RefObject<HTMLButtonElement | null>
  open?: boolean
  onToggle?: () => void
}) {
  const internalRef = useRef<HTMLButtonElement>(null)
  const btnRef = externalRef ?? internalRef
  const menuRef = useRef<HTMLDivElement>(null)
  const previewId = selectedIconId || 'star'
  const PreviewIcon = resolveBuilderOverlayIcon(previewId)
  const isControlled = open !== undefined && onToggle !== undefined

  const [internalOpen, setInternalOpen] = useState(false)
  const menuOpen = isControlled ? open! : internalOpen
  const toggle = () => {
    if (isControlled) onToggle!()
    else setInternalOpen(v => !v)
  }
  const close = () => {
    if (isControlled) {
      if (open) onToggle!()
    } else {
      setInternalOpen(false)
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    return registerEscapeHandler(close)
  }, [menuOpen])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Icons — add or change icon on this section"
        onClick={toggle}
        className={cn(
          'relative flex h-7 w-[3.1rem] shrink-0 items-center justify-center gap-0.5 rounded-md border border-gray-200 bg-white px-0.5 text-[8px] font-bold leading-tight transition-colors hover:bg-accent',
          (active || menuOpen) && 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/30',
        )}
      >
        <PreviewIcon className="h-3 w-3 shrink-0" />
        <span className="truncate text-center">Icons</span>
      </button>

      <OverlayIconPickerMenu
        open={menuOpen}
        anchorRef={btnRef}
        menuRef={menuRef}
        value={previewId}
        onPick={id => {
          onPickIcon(id)
          close()
        }}
      />
    </>
  )
}
