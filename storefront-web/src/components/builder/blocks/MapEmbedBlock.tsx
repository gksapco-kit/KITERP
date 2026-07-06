import { MapPin, Navigation } from 'lucide-react'
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

export default function MapEmbedBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const vendor = useEffectiveVendor()

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Find Us'),
  })
  const profile = liveItems[0]
  const addressHidden = isBlockFieldHidden(props, 'address')
  const address = addressHidden
    ? null
    : resolveBusinessContactAddress(props.address as string | undefined, profile, vendor)
  const lat = (props.lat as number | null) || (profile?.meta?.latitude as number | null) || null
  const lng = (props.lng as number | null) || (profile?.meta?.longitude as number | null) || null

  const mapSrc = !addressHidden && lat && lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`
    : !addressHidden && address
    ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
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

  const directionsUrl = address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null

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
            {!isMinimal && <p className="text-sm">Add an address to show the map</p>}
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
