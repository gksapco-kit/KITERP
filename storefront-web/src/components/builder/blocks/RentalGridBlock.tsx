import { Link, useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Boxes, Shield, ArrowRight, Package2 } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'
import {
  catalogGridColClassForBreakpoint,
  clampCatalogColumns,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'
import { cn, imgUrl } from '@/lib/utils'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { vendorDashboardUrl } from '@/lib/vendorDashboardUrl'

interface Props {
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

/** Placeholder cards shown in the builder when no rental assets are live yet. */
const PLACEHOLDER_ITEMS: LiveItem[] = [
  {
    id: 'p1', title: 'Cold-Chain Rack A', subtitle: 'Storage rack · available',
    description: 'Insulated storage rack for dairy and refrigerated goods.',
    image_url: null, price: 350, price_formatted: '₹350/day', rating: null, url: null,
    meta: { location: 'Warehouse 1', deposit_amount: 1500, daily_rate: 350, monthly_rate: 8000, available_capacity: 8, capacity_unit: 'slots', category: 'storage_rack', status: 'available' },
  },
  {
    id: 'p2', title: 'Refrigerated Van #2', subtitle: 'Vehicle · available',
    description: 'Temperature-controlled delivery van — up to 1 tonne payload.',
    image_url: null, price: 1200, price_formatted: '₹1,200/day', rating: null, url: null,
    meta: { location: 'Depot B', deposit_amount: 5000, daily_rate: 1200, monthly_rate: 28000, available_capacity: 1, capacity_unit: 'van', category: 'vehicles', status: 'available' },
  },
  {
    id: 'p3', title: 'Display Freezer Unit', subtitle: 'Equipment · partially occupied',
    description: 'Retail-grade upright freezer for store fronts.',
    image_url: null, price: 700, price_formatted: '₹700/day', rating: null, url: null,
    meta: { location: 'Store Rack 3', deposit_amount: 2500, daily_rate: 700, monthly_rate: 15000, available_capacity: 3, capacity_unit: 'units', category: 'furniture', status: 'partially_occupied' },
  },
]

function statusDot(status?: string) {
  if (status === 'available') return 'bg-emerald-500'
  if (status === 'partially_occupied') return 'bg-amber-500'
  return 'bg-gray-400'
}
function statusTone(status?: string) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-800 border-emerald-100'
  if (status === 'partially_occupied') return 'bg-amber-50 text-amber-800 border-amber-100'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

export default function RentalGridBlock({ style, props, liveItems, blockId }: Props) {
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const previewBp = isEditorCanvas ? (builderCanvas?.previewBreakpoint ?? 'desktop') : 'desktop'

  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const rawColumns = props.columns as number | undefined
  const columns = clampCatalogColumns(rawColumns, 3, 'rental_grid')
  const gridColClass = catalogGridColClassForBreakpoint(columns, previewBp)
  const cardLayout = readCatalogCardLayout(props, 'rental_grid', { defaultColumns: 3 })

  const useLive = liveItems.length > 0
  const items = useLive ? liveItems : PLACEHOLDER_ITEMS.slice(0, columns * 2)

  // Empty state in builder when no assets have been added to the catalog yet
  if (!useLive && !isEditorCanvas) return null

  if (!useLive && isEditorCanvas) {
    return (
      <section className={builderSectionContainerClass()}>
        {showTitle && (
          <BuilderTextField
            fieldKey="title" blockId={blockId} blockProps={props}
            value={title ?? ''} as="h2"
            className="text-3xl font-bold text-gray-900 mb-8 text-center"
            placeholder="Section title"
          />
        )}
        <BlockEmptyPlaceholder
          style={style}
          title="No rental assets yet"
          message="Rental assets from your catalog will appear here once you add them."
          hint="Add assets in Rental → Assets. They'll appear here automatically."
          actionHref={vendorDashboardUrl('/rental/assets')}
          actionLabel="Add rental assets"
          icon={<Package2 className="w-10 h-10" style={{ color: style.primary_color }} />}
        />
      </section>
    )
  }

  return (
    <section className={builderSectionContainerClass()}>
      {showTitle && (
        <BuilderTextField
          fieldKey="title" blockId={blockId} blockProps={props}
          value={title ?? ''} as="h2"
          className="text-3xl font-bold text-gray-900 mb-8 text-center"
          placeholder="Section title"
        />
      )}

      <div className={cn('grid', gridColClass)} style={{ gap: cardLayout.itemGap }}>
        {items.map((item) => {
          const meta = (item.meta || {}) as Record<string, unknown>
          const dailyRate = Number(meta.daily_rate ?? item.price ?? 0)
          const monthlyRate = Number(meta.monthly_rate ?? 0)
          const deposit = Number(meta.deposit_amount ?? 0)
          const location = meta.location as string | undefined
          const assetStatus = (meta.status as string | undefined) ?? 'available'
          const availCap = Number(meta.available_capacity ?? 0)
          const capacityUnit = (meta.capacity_unit as string | undefined) ?? 'units'
          const category = ((meta.category as string | undefined) ?? '').replace(/_/g, ' ')

          const itemUrl = item.url
            ? storePath(item.url)
            : storePath(`/rentals/${item.id}`)
          const goDetail = () => {
            if (isEditorCanvas) return
            navigate(itemUrl)
          }

          return (
            <article
              key={item.id}
              role={isEditorCanvas ? undefined : 'link'}
              tabIndex={isEditorCanvas ? undefined : 0}
              onClick={goDetail}
              onKeyDown={(e) => {
                if (isEditorCanvas) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  goDetail()
                }
              }}
              className={cn(
                'builder-tile-card bg-white border border-gray-100 transition-all duration-200',
                'flex flex-col overflow-hidden',
                cardLayout.cardRadius,
                'hover:shadow-lg hover:-translate-y-0.5',
                !isEditorCanvas && 'cursor-pointer',
              )}
            >
              {/* Image or gradient placeholder */}
              {item.image_url ? (
                <div className="relative overflow-hidden" style={{ paddingTop: '56%' }}>
                  <img
                    src={imgUrl(item.image_url)}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{ height: 120, background: `linear-gradient(135deg, ${style.primary_color}18 0%, ${style.primary_color}08 100%)` }}
                >
                  <Package2 className="w-10 h-10 opacity-30" style={{ color: style.primary_color }} />
                </div>
              )}

              <div className="flex flex-col flex-1 p-4 gap-2">
                {/* Header row — name + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[15px] text-gray-900 tracking-tight truncate">
                      {item.title}
                    </h3>
                    {category && (
                      <p className="text-[11px] text-gray-400 mt-0.5 capitalize truncate">{category}</p>
                    )}
                  </div>
                  <span className={cn(
                    'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize whitespace-nowrap',
                    statusTone(assetStatus),
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', statusDot(assetStatus))} />
                    {assetStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Description */}
                {item.description && !cardLayout.isMinimalCard && (
                  <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                )}

                {/* Meta chips */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  {location && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{location}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Boxes className="w-3 h-3 text-gray-400" />
                    <span className="tabular-nums">{availCap} {capacityUnit}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>Book now</span>
                  </span>
                </div>

                {/* Footer — pricing + CTA */}
                <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {dailyRate > 0 && (
                      <p className="text-sm font-bold text-gray-900 tabular-nums leading-none">
                        {item.price_formatted ?? `₹${dailyRate.toLocaleString('en-IN')}/day`}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      {monthlyRate > 0 && (
                        <span className="tabular-nums">₹{monthlyRate.toLocaleString('en-IN')}/mo ·</span>
                      )}
                      <Shield className="w-2.5 h-2.5" />
                      <span className="tabular-nums">₹{deposit.toLocaleString('en-IN')} deposit</span>
                    </p>
                  </div>
                  <Link
                    to={itemUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
                    style={{ color: style.primary_color }}
                  >
                    Details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* View all link */}
      <div className="mt-8 text-center">
        <Link
          to={storePath('/rentals')}
          className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
          style={{ color: style.primary_color }}
        >
          View all rentals <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}
