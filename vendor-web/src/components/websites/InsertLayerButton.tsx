import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import { VISUAL_INSERT_TYPES } from '@/lib/builderVisualPresets'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import type { OverlayLayerItem } from '@/lib/builderOverlayVisual'

/**
 * Prominent "Insert" button + layer picker. Shared by the General and Visual
 * design-bar tabs so adding text / images / icons / shapes is always one click away.
 */
export function InsertLayerButton({
  overlayCount,
  onAddOverlay,
  onClearOverlays,
}: {
  overlayCount: number
  onAddOverlay: (type: string, anchor?: { x: number; y: number }, patch?: Partial<OverlayLayerItem>) => void
  onClearOverlays: () => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    return registerEscapeHandler(() => setOpen(false))
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Insert a layer — text, image, icon, button or shape"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors',
          open
            ? 'border-primary bg-primary text-white shadow-sm'
            : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
        )}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span>Insert</span>
        {overlayCount > 0 ? (
          <span className={cn(
            'rounded-full px-1 text-[9px] font-black',
            open ? 'bg-white/25 text-white' : 'bg-primary/20 text-primary',
          )}>
            {overlayCount}
          </span>
        ) : null}
        <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-70', open && 'rotate-180')} />
      </button>

      <DesignBarDropdownPortal
        open={open}
        anchorRef={btnRef}
        menuRef={menuRef}
        className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl overflow-hidden w-[17rem] max-h-[90vh] overflow-y-auto"
      >
        <div className="px-2.5 py-2 bg-accent border-b border-primary/20">
          <div className="text-[11px] font-bold text-primary">Insert layer</div>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {VISUAL_INSERT_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              title={label}
              onMouseDown={e => {
                e.stopPropagation()
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                onAddOverlay(type, { x: rect.right + 8, y: rect.top })
                setOpen(false)
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-2 text-center transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span className="text-base leading-none">{label.split(' ')[0]}</span>
              <span className="text-[9px] font-semibold leading-tight text-gray-700 line-clamp-2">
                {label.slice(label.indexOf(' ') + 1)}
              </span>
            </button>
          ))}
        </div>
        {overlayCount > 0 ? (
          <div className="flex items-center justify-between border-t border-border bg-muted/25 px-2.5 py-1.5">
            <span className="text-[10px] text-gray-500">{overlayCount} layer{overlayCount !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onMouseDown={e => {
                e.stopPropagation()
                onClearOverlays()
                setOpen(false)
              }}
              className="text-[10px] font-semibold text-red-500 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </DesignBarDropdownPortal>
    </>
  )
}
