import { useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import { OFFER_LAYOUT_THUMBNAILS, layoutThumbnailLabel } from '@/lib/offerLayoutThumbnails'
import type { OfferLayoutId } from '@/lib/offerLayouts'

export function OfferLayoutThemeGrid({
  selectedId,
  accentColor = '#1a56db',
  onSelect,
  compact = false,
}: {
  selectedId: OfferLayoutId | string
  accentColor?: string
  onSelect: (id: OfferLayoutId) => void
  compact?: boolean
}) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth', inline: 'nearest' })
  }, [selectedId])

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${compact ? 'max-h-[220px]' : 'max-h-[480px]'} overflow-y-auto overflow-x-hidden pr-1`}>
      {OFFER_LAYOUT_THUMBNAILS.map(tmpl => {
        const active = selectedId === tmpl.id
        return (
          <button
            key={tmpl.id}
            type="button"
            ref={active ? selectedRef : undefined}
            onClick={() => onSelect(tmpl.id as OfferLayoutId)}
            className={`relative rounded-lg border-2 p-1.5 transition-all text-left ${
              active ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            {active && (
              <>
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center z-10">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="absolute top-1 left-1 z-10 text-[8px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-blue-600 text-white">
                  Active
                </div>
              </>
            )}
            <div
              className="w-full rounded overflow-hidden border border-gray-100 bg-white"
              dangerouslySetInnerHTML={{ __html: tmpl.svg(accentColor) }}
            />
            <p className={`mt-1 text-[10px] font-medium truncate leading-tight ${active ? 'text-blue-800' : 'text-gray-800'}`}>
              {tmpl.name}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export { layoutThumbnailLabel }
