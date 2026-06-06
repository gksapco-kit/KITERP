/**
 * Palette dots for template cards and preview (API or fallback by template id).
 */
import type { WebsiteTemplate } from '@/types/websites'

export function getTemplatePreviewPalette(tpl: WebsiteTemplate): string[] {
  const fromApi = (tpl.preview_palette || []).filter(Boolean) as string[]
  if (fromApi.length >= 3) return fromApi.slice(0, 5)
  const fallback: Record<string, string[]> = {
    portfolio: ['#111827', '#8B5CF6', '#374151', '#e5e7eb'],
    storefront_fashion: ['#221D1A', '#E45E25', '#F9F7F5', '#A89C8F'],
    storefront_electronics: ['#15181D', '#298EF3', '#0C0E11', '#F3F4F6'],
    storefront_grocery: ['#274832', '#E07A5F', '#F9F9F5', '#4A7A58', '#182E20'],
    storefront_services: ['#482E27', '#E44B25', '#F6F2EE', '#2E1D18'],
    atelier: ['#2e1f14', '#e55a23', '#f5ede0', '#5c3d27'],
    verde: ['#0e1714', '#e8a33c', '#c2892e', '#e8dcc8'],
    solace: ['#2e8a6e', '#236b56', '#eff8f4', '#1a3d32'],
  }
  return fallback[tpl.id] || ['#64C3A0', '#f97316', '#10b981', '#111827']
}
