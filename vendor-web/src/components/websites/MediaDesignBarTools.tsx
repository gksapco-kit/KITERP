import { ImageIcon, Upload } from 'lucide-react'
import { MediaClipPicker, mediaClipActiveLabel } from '@/components/websites/MediaClipPicker'
import { cn } from '@/lib/utils'
import { sectionSupportsMediaClip } from '@storefront/lib/designBarCapabilities'
import { visualTabShell } from '@/components/websites/designBarVisualUi'
import type { BlockProps } from '@/types/websites'

export function MediaDesignBarTools({
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

  return (
    <div className={cn(visualTabShell, 'gap-2 px-1')}>
      {supportsClip ? (
        <div className="flex min-w-0 shrink-0 flex-col gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Clip shape</div>
          <MediaClipPicker
            compact
            value={(blockProps as { media_clip?: string }).media_clip}
            onChange={clip => onUpdate({ media_clip: clip } as Partial<BlockProps>)}
          />
          {clipLabel && clipLabel !== 'None' ? (
            <div className="text-[10px] text-primary font-semibold">{clipLabel}</div>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {onPickImage ? (
          <button
            type="button"
            title="Upload image to this section"
            onClick={onPickImage}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 text-[10px] font-bold text-sky-800 transition-colors hover:bg-sky-100"
          >
            <Upload className="h-3 w-3 shrink-0" />
            Upload
          </button>
        ) : null}
        {onOpenMediaLibrary ? (
          <button
            type="button"
            title="Open media library"
            onClick={onOpenMediaLibrary}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <ImageIcon className="h-3 w-3 shrink-0" />
            Library
          </button>
        ) : null}
        {primaryImageField && !canvasImageField && onFocusPrimaryImage ? (
          <button
            type="button"
            title="Select this section's image on the canvas for focal & zoom tools"
            onClick={onFocusPrimaryImage}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-[10px] font-bold text-primary transition-colors hover:bg-primary/15"
          >
            Select image
          </button>
        ) : null}
      </div>

      <p className="min-w-[12rem] text-[10px] leading-snug text-gray-500">
        {canvasImageField
          ? 'Image selected — use General or Visual for focal, zoom, and fit.'
          : primaryImageField
            ? 'Click the section photo on the canvas, or use Upload / Library above.'
            : 'Use Upload or Library for images. Clip shapes apply wherever this section shows photo or video.'}
        {' '}More assets live in the right panel{' '}
        <span className="font-semibold text-gray-600">Media</span> tab.
      </p>
    </div>
  )
}
