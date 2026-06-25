import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ImageIcon, Scissors, Upload } from 'lucide-react'
import { MediaClipPicker, mediaClipActiveLabel } from '@/components/websites/MediaClipPicker'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import { cn } from '@/lib/utils'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import {
  visualActionBtn,
  visualMenuTrigger,
  visualTabMenuTrigger,
} from '@/components/websites/designBarVisualUi'
import { sectionSupportsMediaClip } from '@storefront/lib/designBarCapabilities'
import { overlayHasMediaSourceControls, type OverlayLayerItem } from '@/lib/builderOverlayVisual'
import type { BlockProps } from '@/types/websites'

/** Upload / Library / Select / Clips — single Visuals menu on the Visual tab. */
export function VisualsDesignBarMenu({
  blockType,
  blockProps,
  primaryImageField,
  canvasImageField,
  selectedOverlay,
  onUpdate,
  onOpenMediaLibrary,
  onPickImage,
  onFocusPrimaryImage,
  onOverlayPickImage,
  onOverlayOpenLibrary,
  onOverlaySetImageUrl,
  visualTab = false,
}: {
  blockType: string
  blockProps: Record<string, unknown>
  primaryImageField?: string | null
  canvasImageField?: string | null
  selectedOverlay?: OverlayLayerItem | null
  onUpdate: (patch: Partial<BlockProps>) => void
  onOpenMediaLibrary?: () => void
  onPickImage?: () => void
  onFocusPrimaryImage?: () => void
  onOverlayPickImage?: () => void
  onOverlayOpenLibrary?: () => void
  onOverlaySetImageUrl?: () => void
  /** Visual tab row — roomier label line-height. */
  visualTab?: boolean
}) {
  const isMediaOverlay = selectedOverlay ? overlayHasMediaSourceControls(selectedOverlay) : false
  const uploadHandler = isMediaOverlay ? onOverlayPickImage : onPickImage
  const libraryHandler = isMediaOverlay ? onOverlayOpenLibrary : onOpenMediaLibrary

  const supportsClip = sectionSupportsMediaClip(blockType) && !selectedOverlay
  const clipLabel = mediaClipActiveLabel((blockProps as { media_clip?: string }).media_clip)
  const hasClip = Boolean(clipLabel)

  const hasUpload = Boolean(uploadHandler)
  const hasLibrary = Boolean(libraryHandler)
  const hasSelect = Boolean(!selectedOverlay && primaryImageField && !canvasImageField && onFocusPrimaryImage)
  const hasUrl = Boolean(isMediaOverlay && onOverlaySetImageUrl)

  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const hasAnyAction = hasUpload || hasLibrary || hasSelect || hasUrl || supportsClip
  if (!hasAnyAction) return null

  const isActive = open || hasClip
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    return registerEscapeHandler(close)
  }, [open])

  const runAndClose = (fn?: () => void) => {
    fn?.()
    close()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Upload, library, select image, and clip shapes"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          (visualTab ? visualTabMenuTrigger : visualMenuTrigger)(isActive, hasClip ? 'emerald' : undefined),
          open && 'ring-1 ring-primary/30',
        )}
      >
        <ImageIcon className="h-3 w-3 shrink-0" />
        <span>Visuals</span>
        {hasClip ? (
          <span className="rounded-full bg-primary/15 px-0.5 text-[7px] font-black text-primary">Clip</span>
        ) : null}
        <ChevronDown className={cn('h-2.5 w-2.5 shrink-0 opacity-60', open && 'rotate-180')} />
      </button>

      <DesignBarDropdownPortal
        open={open}
        anchorRef={btnRef}
        menuRef={menuRef}
        className="w-[17rem] max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-xs font-bold text-gray-800">Visuals</div>
          <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
            {isMediaOverlay
              ? selectedOverlay?.type === 'video'
                ? 'Replace or source the selected video layer.'
                : 'Replace or source the selected image layer.'
              : 'Add images, pick from your library, or apply clip shapes to this section.'}
          </p>
        </div>

        {hasUpload || hasLibrary || hasSelect || hasUrl ? (
          <div className="flex flex-wrap gap-1 border-b border-gray-100 p-2">
            {hasUpload ? (
              <button
                type="button"
                title="Upload image"
                onClick={() => runAndClose(uploadHandler)}
                className={cn(visualActionBtn('sky'), 'gap-1 px-2')}
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>Upload</span>
              </button>
            ) : null}
            {hasLibrary ? (
              <button
                type="button"
                title="Open media library"
                onClick={() => runAndClose(libraryHandler)}
                className={cn(visualActionBtn('emerald'), 'gap-1 px-2')}
              >
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Library</span>
              </button>
            ) : null}
            {hasSelect ? (
              <button
                type="button"
                title="Select this section's image on the canvas for focal and zoom tools"
                onClick={() => runAndClose(onFocusPrimaryImage)}
                className={cn(visualActionBtn('primary'), 'gap-1 px-2')}
              >
                <span>Select</span>
              </button>
            ) : null}
            {hasUrl ? (
              <button
                type="button"
                title="Set image from URL"
                onClick={() => runAndClose(onOverlaySetImageUrl)}
                className={cn(visualActionBtn('primary'), 'gap-1 px-2')}
              >
                <span>URL</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {supportsClip ? (
          <div className="p-2">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <Scissors className="h-3 w-3 shrink-0" />
              Clip shapes
            </div>
            {clipLabel ? (
              <p className="mb-1.5 text-[10px] font-semibold text-primary">Selected: {clipLabel}</p>
            ) : null}
            <MediaClipPicker
              compact
              value={(blockProps as { media_clip?: string }).media_clip}
              onChange={clip => {
                onUpdate({ media_clip: clip } as Partial<BlockProps>)
              }}
            />
          </div>
        ) : null}
      </DesignBarDropdownPortal>
    </>
  )
}

/** @deprecated Use VisualsDesignBarMenu inside the Visual tab. */
export const MediaDesignBarStrip = VisualsDesignBarMenu
