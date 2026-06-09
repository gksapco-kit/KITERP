import { cn } from '@/lib/utils'
import {
  MEDIA_CLIP_OPTIONS,
  mediaClipStyle,
  normalizeMediaClip,
  type MediaClipId,
} from '@storefront/lib/mediaClip'

export function mediaClipActiveLabel(value: unknown): string | null {
  const current = normalizeMediaClip(value)
  if (current === 'none') return null
  return MEDIA_CLIP_OPTIONS.find(o => o.id === current)?.shortLabel ?? null
}

export function MediaClipPicker({
  value,
  onChange,
  compact = false,
}: {
  value?: unknown
  onChange: (clip: MediaClipId | null) => void
  compact?: boolean
}) {
  const current = normalizeMediaClip(value)

  return (
    <div className={cn('space-y-2', compact ? '' : 'rounded-xl border border-gray-100 bg-gray-50 p-3')}>
      {!compact && (
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Media clip shape</span>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
            {MEDIA_CLIP_OPTIONS.length - 1} angled, geometric, and organic frames for photos &amp; video
          </p>
        </div>
      )}
      <div
        className={cn(
          'grid gap-1.5',
          compact
            ? 'grid-cols-5 max-h-[min(18rem,55vh)] overflow-y-auto overscroll-contain pr-0.5'
            : 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-6',
        )}
      >
        {MEDIA_CLIP_OPTIONS.map(opt => {
          const active = current === opt.id
          const label = compact ? opt.shortLabel : opt.label
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.hint || opt.label}
              onClick={() => onChange(opt.id === 'none' ? null : opt.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-lg border font-semibold transition-colors',
                compact ? 'text-[9px] min-w-0' : 'text-[10px]',
                active
                  ? 'border-primary bg-white text-primary shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'block w-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25',
                  compact ? 'max-w-[1.85rem] aspect-square' : 'max-w-[2.25rem] aspect-[4/3]',
                )}
                style={opt.id === 'none' ? undefined : mediaClipStyle(opt.id)}
              />
              <span className="w-full text-center leading-tight break-words hyphens-auto px-0.5">
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
