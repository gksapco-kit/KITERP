export interface CatalogAddon {
  id: string
  name: string
  item_type: 'product' | 'service'
  addon_type: string
  booking_trigger: string
  trigger_status?: string
  optional: boolean
}

export function catalogItemPath(itemType: 'product' | 'service', id: string): string {
  return itemType === 'service' ? `/services/${id}` : `/products/${id}`
}

/** Normalize API add-ons (legacy string IDs or structured objects). */
export function normalizeCatalogAddons(raw: unknown): CatalogAddon[] {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : []
  return arr
    .map((item, i) => {
      if (typeof item === 'string') {
        const id = item.trim()
        if (!id) return null
        return {
          id,
          name: id,
          item_type: 'service' as const,
          addon_type: 'other',
          booking_trigger: 'at_sale',
          optional: true,
        }
      }
      if (typeof item !== 'object' || item === null) return null
      const o = item as Record<string, unknown>
      const id = String(o.id || o.linked_product_id || '')
      if (!id) return null
      return {
        id,
        name: String(o.name || id),
        item_type: o.item_type === 'product' ? 'product' : 'service',
        addon_type: String(o.addon_type || 'other'),
        booking_trigger: String(o.booking_trigger || 'at_sale'),
        trigger_status: o.trigger_status ? String(o.trigger_status) : undefined,
        optional: o.optional !== false,
      }
    })
    .filter((a): a is CatalogAddon => a !== null)
}

export function serializeCatalogAddons(addons: CatalogAddon[]): CatalogAddon[] {
  return addons.map(a => ({
    id: a.id,
    name: a.name,
    item_type: a.item_type,
    addon_type: a.addon_type,
    booking_trigger: a.booking_trigger,
    ...(a.trigger_status ? { trigger_status: a.trigger_status } : {}),
    optional: a.optional,
  }))
}
