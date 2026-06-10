import { cn } from '@/lib/utils'
import {
  MEDIA_CLIP_GROUPS,
  MEDIA_CLIP_OPTIONS,
  mediaClipOptionsForIds,
  mediaClipStyle,
  normalizeMediaClip,
  type MediaClipId,
  type MediaClipOption,
} from '@storefront/lib/mediaClip'

export function mediaClipActiveLabel(value: unknown): string | null {
  const current = normalizeMediaClip(value)
  if (current === 'none') return null
  return MEDIA_CLIP_OPTIONS.find(o => o.id === current)?.shortLabel ?? null
}

function clipOptionTitle(opt: MediaClipOption): string {
  return opt.hint ? `${opt.label} — ${opt.hint}` : opt.label
}

function MediaClipTile({
  opt,
  active,
  compact,
  onSelect,
}: {
  opt: MediaClipOption
  active: boolean
  compact: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      title={clipOptionTitle(opt)}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border font-semibold transition-colors',
        compact ? 'py-1 px-1 text-[9px] min-w-[3.25rem]' : 'py-1.5 px-1 text-[10px] min-w-[3.5rem]',
        active
          ? 'border-primary bg-white text-primary shadow-sm ring-1 ring-primary/20'
          : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'block shrink-0 bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
        style={opt.id === 'none' ? undefined : mediaClipStyle(opt.id)}
      />
      <span className="w-full text-center leading-none whitespace-nowrap">
        {opt.shortLabel}
      </span>
    </button>
  )
}

function MediaClipGrid({
  options,
  current,
  compact,
  onChange,
  className,
}: {
  options: MediaClipOption[]
  current: MediaClipId
  compact: boolean
  onChange: (clip: MediaClipId | null) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map(opt => (
        <MediaClipTile
          key={opt.id}
          opt={opt}
          active={current === opt.id}
          compact={compact}
          onSelect={() => onChange(opt.id === 'none' ? null : opt.id)}
        />
      ))}
    </div>
  )
}

export function MediaClipPicker({
  value,
  onChange,
  compact = false,
  embedded = false,
}: {
  value?: unknown
  onChange: (clip: MediaClipId | null) => void
  compact?: boolean
  /** Inside SectionPanelGroup — no outer card chrome. */
  embedded?: boolean
}) {
  const current = normalizeMediaClip(value)

  return (
    <div className={cn(
      'space-y-2',
      compact || embedded ? '' : 'rounded-xl border border-gray-100 bg-gray-50 p-3',
    )}>
      {!compact && !embedded && (
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Media clip shape</span>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
            Crop photos &amp; video with angled, geometric, or organic frames. Hover a shape for the full name.
          </p>
        </div>
      )}
      {compact ? (
        <div className="max-h-[min(18rem,55vh)] overflow-y-auto overscroll-contain pr-0.5">
          <MediaClipGrid
            options={MEDIA_CLIP_OPTIONS}
            current={current}
            compact={compact}
            onChange={onChange}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {MEDIA_CLIP_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                {group.label}
              </div>
              <MediaClipGrid
                options={mediaClipOptionsForIds(group.ids)}
                current={current}
                compact={compact}
                onChange={onChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
