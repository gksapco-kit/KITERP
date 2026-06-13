import { resolveStoreFrontTemplateId } from '@/lib/liveStorefrontUrl'

type StoreLike = {
  id: string
  name: string
  settings?: Record<string, unknown> | null
}

export function storesAssignedToTemplate(stores: StoreLike[], templateId: string): StoreLike[] {
  return stores.filter(s => resolveStoreFrontTemplateId(s.settings) === templateId)
}

export function formatAssignedStoresLabel(stores: Pick<StoreLike, 'name'>[], maxVisible = 2): string {
  if (stores.length === 0) return ''
  if (stores.length === 1) return stores[0].name
  if (stores.length <= maxVisible) return stores.map(s => s.name).join(', ')
  const visible = stores.slice(0, maxVisible).map(s => s.name).join(', ')
  return `${visible} +${stores.length - maxVisible}`
}
