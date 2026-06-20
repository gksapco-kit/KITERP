import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ImageIcon, Scissors, Upload } from 'lucide-react'
import { MediaClipPicker, mediaClipActiveLabel } from '@/components/websites/MediaClipPicker'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import { cn } from '@/lib/utils'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import {
  visualActionBtn,
  visualMenuTrigger,
  visualPanel,
} from '@/components/websites/designBarVisualUi'
import { sectionSupportsMediaClip } from '@storefront/lib/designBarCapabilities'
import type { BlockProps } from '@/types/websites'

type MediaDropdown = 'clips' | null

/** Upload / Library / Clips strip — embed inside Visual tab (no outer shell). */
export function MediaDesignBarStrip({
  blockType,
  blockProps,
  primaryImageField,
  canvasImageField,
  onUpdate,
  onOpenMediaLibrary,
  onPickImage,
  onFocusPrimaryImage,
}: {
  blockType: string
  blockProps: Record<string, unknown>
  primaryImageField?: string | null
  canvasImageField?: string | null
  onUpdate: (patch: Partial<BlockProps>) => void
  onOpenMediaLibrary?: () => void
  onPickImage?: () => void
  onFocusPrimaryImage?: () => void
}) {
  const supportsClip = sectionSupportsMediaClip(blockType)
  const clipLabel = mediaClipActiveLabel((blockProps as { media_clip?: string }).media_clip)
  const hasClip = Boolean(clipLabel)
  const [openMenu, setOpenMenu] = useState<MediaDropdown>(null)
  const clipsBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const hasUpload = Boolean(onPickImage)
  const hasLibrary = Boolean(onOpenMediaLibrary)
  const hasSelect = Boolean(primaryImageField && !canvasImageField && onFocusPrimaryImage)
  if (!hasUpload && !hasLibrary && !hasSelect && !supportsClip) return null

  const toggleClips = () => setOpenMenu(prev => (prev === 'clips' ? null : 'clips'))
  const closeAll = () => setOpenMenu(null)

  useEffect(() => {
    if (!openMenu) return
    return registerEscapeHandler(closeAll)
  }, [openMenu])

  return (
    <>
      <div className={cn(visualPanel, 'shrink-0')}>
        {onPickImage ? (
          <button
            type="button"
            title="Upload image to this section"
            onClick={onPickImage}
            className={cn(visualActionBtn('sky'), 'gap-1 px-2')}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span>Upload</span>
          </button>
        ) : null}
        {onOpenMediaLibrary ? (
          <button
            type="button"
            title="Open media library"
            onClick={onOpenMediaLibrary}
            className={cn(visualActionBtn('emerald'), 'gap-1 px-2')}
          >
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Library</span>
          </button>
        ) : null}
        {hasSelect ? (
          <button
            type="button"
            title="Select this section's image on the canvas for focal & zoom tools"
            onClick={onFocusPrimaryImage}
            className={cn(visualActionBtn('primary'), 'gap-1 px-2')}
          >
            <span>Select</span>
          </button>
        ) : null}
      </div>

      {supportsClip ? (
        <button
          ref={clipsBtnRef}
          type="button"
          title={clipLabel ? `Clip: ${clipLabel}` : 'Crop photos and video with angled or organic clip shapes'}
          onClick={toggleClips}
          className={cn(
            visualMenuTrigger(hasClip || openMenu === 'clips'),
            openMenu === 'clips' && 'ring-1 ring-primary/30',
          )}
        >
          <Scissors className="h-3.5 w-3.5 shrink-0" />
          <span>{clipLabel ?? 'Clips'}</span>
          <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-50', openMenu === 'clips' && 'rotate-180')} />
        </button>
      ) : null}

      <DesignBarDropdownPortal
        open={openMenu === 'clips'}
        anchorRef={clipsBtnRef}
        menuRef={menuRef}
        className="w-[17rem] max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-xs font-bold text-gray-800">Media clip frames</div>
          <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
            Crop photos and video with angled or organic shapes. Hover a tile for the full name.
          </p>
          {clipLabel ? (
            <p className="mt-1 text-[10px] font-semibold text-primary">Selected: {clipLabel}</p>
          ) : null}
        </div>
        <div className="p-2">
          <MediaClipPicker
            compact
            value={(blockProps as { media_clip?: string }).media_clip}
            onChange={clip => {
              onUpdate({ media_clip: clip } as Partial<BlockProps>)
            }}
          />
        </div>
      </DesignBarDropdownPortal>
    </>
  )
}
