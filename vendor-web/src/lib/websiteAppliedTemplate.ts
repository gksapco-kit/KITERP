import type { SiteListItem, WebsiteTemplate } from '@/types/websites'
import type { ThemePresetSummary } from '@/lib/businessFrontActiveTemplate'

const BUSINESS_TYPE_TEMPLATE_LABELS: Record<string, string> = {
  retail: 'Healthy Retail',
  services: 'Service Business',
  restaurant: 'Restaurant / Cafe',
  fashion: 'Fashion / Boutique',
  electronics: 'Electronics Store',
  salon: 'Salon / Spa',
  clinic: 'Clinic / Healthcare',
  consulting: 'Consultant / Agency',
}

export function resolveSiteAppliedTemplateLabel(
  site: Pick<SiteListItem, 'applied_template_id' | 'applied_template_name'>,
  templates: WebsiteTemplate[] = [],
): string | null {
  if (site.applied_template_name?.trim()) return site.applied_template_name.trim()

  const tid = site.applied_template_id?.trim()
  if (tid) {
    const match = templates.find(t => t.id === tid)
    return match?.name ?? tid.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return null
}

export function resolveMainStorefrontTemplateLabel(
  themeTemplateId: string | undefined,
  presets: ThemePresetSummary[],
): string {
  const presetId = themeTemplateId === 'light' || themeTemplateId === 'dark' ? themeTemplateId : 'light'
  const preset = presets.find(p => p.id === presetId)
  return preset?.name ?? 'Light'
}

export function resolveTemplateThumbnail(
  templateId: string | null | undefined,
  templates: WebsiteTemplate[] = [],
): string | null {
  const tid = templateId?.trim()
  if (!tid) return null
  return templates.find(t => t.id === tid)?.thumbnail ?? null
}

export type ResolvedTemplateDisplay = {
  id: string
  name: string
  description?: string
  thumbnail?: string | null
  gradient?: string
}

/** Resolve display info for a template id (builder site, catalog template, or legacy preset). */
export function resolveTemplateDisplay(
  templateId: string | null | undefined,
  templates: WebsiteTemplate[] = [],
  presets: ThemePresetSummary[] = [],
  sites: Pick<SiteListItem, 'id' | 'name' | 'applied_template_id' | 'applied_template_name' | 'description'>[] = [],
): ResolvedTemplateDisplay | null {
  const tid = templateId?.trim()
  if (!tid) return null
  const tpl = templates.find(t => t.id === tid)
  if (tpl) {
    return {
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      thumbnail: tpl.thumbnail,
    }
  }
  const site = sites.find(s => s.id === tid)
  if (site) {
    const name = resolveSiteAppliedTemplateLabel(site, templates) ?? site.name
    return {
      id: site.id,
      name,
      description: site.description ?? undefined,
    }
  }
  const preset = presets.find(p => p.id === tid)
  if (preset) {
    const colors = preset.colors
    const palette = colors
      ? [colors.primary, colors.secondary, colors.accent, colors.background].filter(Boolean) as string[]
      : []
    const gradient =
      palette.length >= 2
        ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
        : 'linear-gradient(135deg, #64C3A0, #13624A)'
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description ?? 'Default storefront theme',
      gradient,
    }
  }
  const readable = tid.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return {
    id: tid,
    name: /^[0-9a-f-]{36}$/i.test(tid) ? 'Website template' : readable,
    description: 'Storefront template',
  }
}

export function businessTypeTemplateLabel(businessType: string | undefined): string | null {
  const key = businessType?.trim()
  if (!key) return null
  return BUSINESS_TYPE_TEMPLATE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
