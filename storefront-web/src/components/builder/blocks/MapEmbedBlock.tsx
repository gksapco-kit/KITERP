import { ExternalLink, MapPin, Navigation } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { resolveBusinessContactAddress } from '@/lib/businessContact'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { cn } from '@/lib/utils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

function placeCardCopy(address: string): { title: string; detail: string } {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length > 1 && parts[0].length <= 32) {
    return { title: parts[0], detail: address }
  }
  return { title: 'Location', detail: address }
}

function readMapCoord(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export default function MapEmbedBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const vendor = useEffectiveVendor()

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Find Us'),
  })
  const profile = liveItems[0]
  const addressHidden = isBlockFieldHidden(props, 'address')
  // Prefer the address typed on this map block; only fall back to business settings when unset.
  const blockAddress = typeof props.address === 'string' ? props.address.trim() : ''
  const address = addressHidden
    ? null
    : (blockAddress || resolveBusinessContactAddress(undefined, profile, vendor) || null)

  const blockLat = readMapCoord(props.lat)
  const blockLng = readMapCoord(props.lng)
  const hasBlockPin = blockLat != null && blockLng != null
  // Do not keep showing the business-unit pin (e.g. store HQ) when the user set a different
  // address on this block — use Google Maps with that address until Find saves coordinates.
  const lat = hasBlockPin
    ? blockLat
    : blockAddress
      ? null
      : readMapCoord(profile?.meta?.latitude)
  const lng = hasBlockPin
    ? blockLng
    : blockAddress
      ? null
      : readMapCoord(profile?.meta?.longitude)

  const mapSrc = lat != null && lng != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`
    : !addressHidden && address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed&iwloc=near`
      : null

  const layout = String(props.layout ?? 'card')
  const isFull = layout === 'full'
  const isSplit = layout === 'split'
  const isMinimal = layout === 'minimal'
  const isStacked = layout === 'stacked'
  const isDark = props.bg_style === 'dark'
  const isGrayscale = props.map_style === 'grayscale'
  const showDirections = props.show_directions === true
  const heightPx = Number(props.height) > 0 ? Number(props.height) : (isMinimal ? 240 : 320)

  const directionsUrl = lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      : null
  const mapsUrl = lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null
  const placeCard = mapsUrl && address && mapSrc?.includes('google.com/maps')
    ? placeCardCopy(address)
    : null

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas) && !isMinimal
  const showAddress = !addressHidden && (address || isEditorCanvas) && !isMinimal

  const mutedTextClass = isDark ? 'text-white/60' : 'text-gray-500'
  const headingClass = isDark ? 'text-white' : 'text-gray-900'

  const addressText = showAddress && (address || isEditorCanvas) ? (
    isEditorCanvas && blockId ? (
      <BuilderTextField fieldKey="address" blockId={blockId} blockProps={props} value={String(props.address ?? address ?? '')} as="span" placeholder="Street address" />
    ) : address
  ) : null

  const mapFrame = (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        !isFull && 'rounded-2xl border shadow-sm',
        !isFull && (isDark ? 'border-white/10' : 'border-gray-200'),
      )}
      style={{ height: `${heightPx}px` }}
    >
      {mapSrc ? (
        <iframe
          src={mapSrc}
          width="100%"
          height="100%"
          style={{ border: 0, filter: isGrayscale ? 'grayscale(1)' : undefined }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Map"
        />
      ) : (
        <div className={cn('w-full h-full flex items-center justify-center', isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-gray-400')}>
          <div className="text-center">
            <MapPin className={cn('mx-auto opacity-30', isMinimal ? 'w-6 h-6' : 'w-10 h-10 mb-2')} />
            {!isMinimal && <p className="text-sm">Set a location in the builder to show the map</p>}
          </div>
        </div>
      )}
      {placeCard && mapsUrl && (
        <div className="absolute left-3 top-3 z-20 w-[min(22rem,calc(100%-1.5rem))] rounded-2xl bg-white p-4 text-gray-900 shadow-[0_1px_3px_rgba(60,64,67,0.3),0_4px_12px_rgba(60,64,67,0.18)]">
          <p className="text-[15px] font-semibold leading-5">{placeCard.title}</p>
          <p className="mt-1 text-[13px] leading-5 text-gray-600">{placeCard.detail}</p>
          <div className="mt-3.5 flex items-center gap-3">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-4 text-sm font-semibold text-white hover:bg-[#1765cc]"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Open in Maps
            </a>
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Directions"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1a73e8] bg-white text-[#1a73e8] hover:bg-[#e8f0fe]"
              >
                <Navigation className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
      {showDirections && directionsUrl && !isSplit && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-md hover:bg-gray-50 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" style={{ color: style.primary_color }} />
          Get Directions
        </a>
      )}
    </div>
  )

  const titleRow = (showTitle || addressText) ? (
    <div className={cn('flex items-center gap-3', isStacked ? 'justify-center text-center flex-col sm:flex-row mb-4' : 'mb-6')}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${style.primary_color}15` }}>
        <MapPin className="w-5 h-5" style={{ color: style.primary_color }} />
      </div>
      <div className={isStacked ? 'text-center sm:text-left' : undefined}>
        {showTitle && (
          <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className={cn('text-2xl font-bold', headingClass)} placeholder="Section title" />
        )}
        {addressText && <p className={cn('mt-1', mutedTextClass)}>{addressText}</p>}
      </div>
    </div>
  ) : null

  const wrapperStyle = isDark ? { background: '#0f172a', color: '#f8fafc' } : undefined

  if (isFull) {
    return (
      <div className="w-full" style={wrapperStyle}>
        {titleRow && <div className={builderSectionContainerWithMax('max-w-6xl')}>{titleRow}</div>}
        {mapFrame}
      </div>
    )
  }

  if (isSplit) {
    return (
      <div className="w-full" style={wrapperStyle}>
        <section className={builderSectionContainerWithMax('max-w-6xl')}>
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              {showTitle && (
                <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className={cn('text-2xl font-bold mb-3', headingClass)} placeholder="Section title" />
              )}
              {addressText && (
                <div className={cn('flex items-start gap-3', mutedTextClass)}>
                  <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: style.primary_color }} />
                  <span>{addressText}</span>
                </div>
              )}
              {showDirections && directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors"
                  style={{ backgroundColor: style.primary_color }}
                >
                  <Navigation className="w-4 h-4" /> Get Directions
                </a>
              )}
            </div>
            {mapFrame}
          </div>
        </section>
      </div>
    )
  }

  if (isMinimal) {
    return (
      <div className="w-full" style={wrapperStyle}>
        <section className={builderSectionContainerWithMax('max-w-md')}>
          {mapFrame}
        </section>
      </div>
    )
  }

  // 'stacked' and 'card' (default) both show the title/address block above the map;
  // 'stacked' centers it, 'card' keeps the classic left-aligned header.
  return (
    <div className="w-full" style={wrapperStyle}>
      <section className={builderSectionContainerWithMax(isStacked ? 'max-w-4xl' : 'max-w-6xl')}>
        {titleRow}
        {mapFrame}
      </section>
    </div>
  )
}
