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

export type BusinessFrontOptionSite = {
  id: string
  name: string
  is_published?: boolean
  custom_domain?: string | null
  applied_template_id?: string | null
  applied_template_name?: string | null
  storefront_assigned?: boolean
}

function sameLabel(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'accent' }) === 0
}

/** Hostname only, so a stored URL and a bare domain compare the same way in the picker. */
export function displayHost(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const host = new URL(withProto).hostname.replace(/\.$/, '')
    return host || null
  } catch {
    const bare = trimmed.replace(/^https?:\/\//i, '').split('/')[0]?.replace(/\.$/, '')
    return bare || null
  }
}

function siteForFrontOption(
  optionId: string,
  sites: BusinessFrontOptionSite[],
  active: boolean,
): BusinessFrontOptionSite | undefined {
  const byId = sites.find(site => site.id === optionId)
  if (byId || !active) return byId
  const applied = sites.filter(site => site.is_published !== false && site.applied_template_id === optionId)
  return applied.find(site => site.custom_domain?.trim())
    ?? applied.find(site => site.storefront_assigned)
    ?? applied[0]
}

/**
 * Name and domain for one Business Front Display option.
 * A copied kit keeps its source name (for example "Sri Sai Home Foods Website").
 * The option that is actually live uses the business name and the custom domain instead.
 */
export function resolveBusinessFrontOptionIdentity(input: {
  optionId: string
  fallbackName: string
  sites: BusinessFrontOptionSite[]
  businessName?: string | null
  /** Used when businessName is empty or still the copied kit name. */
  otherBusinessNames?: Array<string | null | undefined>
  externalDomain?: string | null
  active: boolean
}): { name: string; domain: string | null } {
  const site = siteForFrontOption(input.optionId, input.sites, input.active)
  const sourceKit = site?.applied_template_name?.trim() || ''
  const fallback = input.fallbackName.trim() || 'Website template'
  let name = (site?.name || fallback).trim() || fallback
  const business = [input.businessName, ...(input.otherBusinessNames ?? [])]
    .map(value => value?.trim() || '')
    .find(value => value && !sameLabel(value, name)) || ''
  const stillNamedAfterKit = Boolean(sourceKit) && sameLabel(name, sourceKit)
  const unnamedSite = !site?.name?.trim()
  if (input.active && business && (stillNamedAfterKit || unnamedSite)) {
    name = business
  }

  const siteHost = displayHost(site?.custom_domain)
  const domain = input.active ? (siteHost || displayHost(input.externalDomain)) : siteHost
  return { name, domain }
}

/**
 * Label for a template already assigned on Business Website Templates.
 * A copied kit name is replaced with the live domain, or the business name when that differs.
 */
export function coverageLiveTemplateLabel(input: {
  templateName: string
  templateId: string
  sites: BusinessFrontOptionSite[]
  storeName?: string | null
  businessNames?: Array<string | null | undefined>
  externalDomain?: string | null
}): string {
  const raw = input.templateName.trim()
  const site = input.sites.find(item => item.id === input.templateId)
    ?? input.sites.find(item => item.is_published !== false && item.applied_template_id === input.templateId)
  const kit = site?.applied_template_name?.trim() || ''
  const namedAfterKit = Boolean(kit) && sameLabel(raw, kit)
  if (raw && !namedAfterKit) return raw

  const siteName = site?.name?.trim() || ''
  if (siteName && !sameLabel(siteName, kit) && !sameLabel(siteName, raw)) return siteName

  const host = displayHost(site?.custom_domain) || displayHost(input.externalDomain)
  if (host) return host

  const business = [input.storeName, ...(input.businessNames ?? [])]
    .map(value => value?.trim() || '')
    .find(value => value && !sameLabel(value, raw) && (!kit || !sameLabel(value, kit)))
  return business || raw || 'Website template'
}

/** Closed-select and menu label. Active stays at the front so a truncated field still shows it. */
export function formatBusinessFrontTemplateOptionLabel(input: {
  name: string
  domain?: string | null
  assignedTo?: string[]
  active: boolean
}): string {
  const name = input.name.trim() || 'Website template'
  if (input.active) {
    const parts = ['Active', name]
    if (input.domain?.trim()) parts.push(input.domain.trim())
    if ((input.assignedTo?.length ?? 0) > 1) parts.push(input.assignedTo!.join(', '))
    return parts.join(' · ')
  }
  if (input.assignedTo?.length) return `${name} · ${input.assignedTo.join(', ')}`
  if (input.domain?.trim()) return `${name} · ${input.domain.trim()}`
  return name
}
