/**
 * Palette dots for template cards and preview (API or fallback by template id).
 */
import type { WebsiteTemplate } from '@/types/websites'

export function getTemplatePreviewPalette(tpl: WebsiteTemplate): string[] {
  const fromApi = (tpl.preview_palette || []).filter(Boolean) as string[]
  if (fromApi.length >= 3) return fromApi.slice(0, 5)
  const fallback: Record<string, string[]> = {
    landing: ['#64C3A0', '#f97316', '#10b981', '#111827'],
    ecommerce: ['#2563eb', '#f59e0b', '#ef4444', '#111827'],
    restaurant: ['#ea580c', '#16a34a', '#f59e0b', '#111827'],
    portfolio: ['#111827', '#64C3A0', '#0ea5e9', '#e5e7eb'],
    blog: ['#111827', '#2563eb', '#f97316', '#e5e7eb'],
    corporate: ['#111827', '#2563eb', '#10b981', '#e5e7eb'],
    saas: ['#64C3A0', '#0ea5e9', '#f59e0b', '#111827'],
    nonprofit: ['#10b981', '#64C3A0', '#f59e0b', '#111827'],
    candy_retail_fiesta: ['#E11D96', '#7C3AED', '#FBBF24', '#FFF1F7', '#0F172A'],
    candy_services_spa: ['#10B981', '#6366F1', '#F472B6', '#F0FDF4', '#0F172A'],
    candy_food_glow: ['#F97316', '#0EA5E9', '#A3E635', '#FFFBEB', '#0F172A'],
  }
  return fallback[tpl.id] || ['#64C3A0', '#f97316', '#10b981', '#111827']
}
