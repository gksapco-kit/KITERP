import { MapPin } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { resolveBusinessContactAddress } from '@/lib/businessContact'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

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

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showAddress = !addressHidden && (address || isEditorCanvas)

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {(showTitle || showAddress) && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${style.primary_color}15` }}>
            <MapPin className="w-5 h-5" style={{ color: style.primary_color }} />
          </div>
          {showTitle && (
            <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-2xl font-bold text-gray-900" placeholder="Section title" />
          )}
        </div>
      )}
      {showAddress && address && (
        <p className="text-gray-500 mb-6 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {isEditorCanvas && blockId ? (
            <BuilderTextField fieldKey="address" blockId={blockId} blockProps={props} value={String(props.address ?? address ?? '')} as="span" placeholder="Street address" />
          ) : address}
        </p>
      )}
      {mapSrc ? (
        <div className="w-full h-80 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <iframe
            src={mapSrc}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Map"
          />
        </div>
      ) : (
        <div className="w-full h-80 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Add an address to show the map</p>
          </div>
        </div>
      )}
    </section>
  )
}
