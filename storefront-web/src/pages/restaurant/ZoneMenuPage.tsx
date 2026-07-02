import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Loader2, Package, UtensilsCrossed, Wrench } from 'lucide-react'
import { restaurantApi, type ZoneMenuCategory, type ZoneMenuItem } from '@/api/restaurant'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function MenuItemRow({ item }: { item: ZoneMenuItem }) {
  const Icon = item.item_type === 'service' ? Wrench : Package
  return (
    <div className="flex items-center gap-3 py-3">
      {item.image_url ? (
        <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-14 h-14 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
        {item.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>}
      </div>
      <span className="shrink-0 text-sm font-bold text-amber-700">{formatCurrency(item.price)}</span>
    </div>
  )
}

function MenuCategorySection({ category, depth }: { category: ZoneMenuCategory; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasContent = category.items.length > 0 || category.children.length > 0

  return (
    <div className={depth === 0 ? 'border-b' : 'border-b border-dashed last:border-b-0'}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className={depth === 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700 text-sm'}>
          {category.name}
        </span>
        {!hasContent && <span className="text-xs text-gray-400 ml-auto">No items</span>}
      </button>
      {expanded && (
        <div style={{ paddingLeft: `${16 + depth * 16}px` }} className="pr-4 pb-2">
          {category.items.length > 0 && (
            <div className="divide-y">
              {category.items.map(item => <MenuItemRow key={`${item.item_type}-${item.id}`} item={item} />)}
            </div>
          )}
          {category.children.map(child => (
            <MenuCategorySection key={child.id} category={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ZoneMenuPage() {
  const { vendorSlug, linkToken } = useParams<{ vendorSlug: string; linkToken: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-restaurant-zone-menu', vendorSlug, linkToken],
    queryFn: () => restaurantApi.getZoneMenu(vendorSlug!, linkToken!),
    enabled: !!vendorSlug && !!linkToken,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-2 p-6 text-center">
        <UtensilsCrossed className="w-10 h-10 text-gray-300" />
        <p className="text-gray-600 font-medium">This menu link is invalid or no longer available.</p>
      </div>
    )
  }

  const { vendor, zone, menu } = data

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 text-lg leading-tight truncate">{vendor.name}</h1>
            <p className="text-sm text-gray-500 truncate">
              {menu.name}
              {zone.name ? ` · ${zone.name}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {menu.categories.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">This menu has no categories yet.</p>
        ) : (
          menu.categories.map(cat => <MenuCategorySection key={cat.id} category={cat} depth={0} />)
        )}
      </div>
    </div>
  )
}
