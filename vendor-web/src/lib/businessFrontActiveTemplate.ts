/** Theme preset ids from GET /vendors/me/template/presets (vendor_template.TEMPLATE_PRESETS). */
export type LegacyThemePresetId = 'light' | 'dark'

export interface ThemePresetSummary {
  id: string
  name: string
  description?: string
  colors?: Record<string, string>
}

export type BusinessFrontActiveKind = 'legacy_preset' | 'website_builder'

export interface BusinessFrontActiveTemplate {
  kind: BusinessFrontActiveKind
  /** Preset id (legacy) or published site id (builder). */
  id: string
  name: string
  description: string
  siteId?: string
}

const DEFAULT_PRESET_ID: LegacyThemePresetId = 'light'
const DEFAULT_PRESET_NAME = 'Light'

function normalizePresetId(themeTemplateId: string | undefined): LegacyThemePresetId {
  const id = themeTemplateId?.trim()
  if (id === 'light' || id === 'dark') return id
  return DEFAULT_PRESET_ID
}

/**
 * Mirrors storefront HomeOrBuilder: when no published wb_site exists, the live home
 * uses legacy Home.tsx + theme_config.template (default light).
 */
export function resolveBusinessFrontActiveTemplate(
  themeTemplateId: string | undefined,
  presets: ThemePresetSummary[],
  sites: { id: string; name: string; is_published: boolean }[],
): BusinessFrontActiveTemplate {
  const published = sites.find(s => s.is_published)
  if (published) {
    return {
      kind: 'website_builder',
      id: published.id,
      name: published.name,
      siteId: published.id,
      description:
        'Your published Business Website Builder site controls the business front home. Unpublish it to use a default theme preset below.',
    }
  }

  const presetId = normalizePresetId(themeTemplateId)
  const preset = presets.find(p => p.id === presetId)
  return {
    kind: 'legacy_preset',
    id: presetId,
    name: preset?.name ?? (presetId === DEFAULT_PRESET_ID ? DEFAULT_PRESET_NAME : presetId),
    description:
      'This default layout is live on your business front when no Business Website Builder site is published.',
  }
}

export function resolveDefaultSingleFrontTemplateId(
  themeTemplateId: string | undefined,
): string {
  return normalizePresetId(themeTemplateId)
}

export function isLegacyPresetActive(
  active: BusinessFrontActiveTemplate,
  presetId: string,
): boolean {
  return active.kind === 'legacy_preset' && active.id === presetId
}
