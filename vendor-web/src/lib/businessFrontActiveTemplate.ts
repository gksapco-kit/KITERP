/** Theme preset ids from GET /vendors/me/template/presets (vendor_template.TEMPLATE_PRESETS). */
export type LegacyThemePresetId =
  | 'retail'
  | 'service'
  | 'hybrid'
  | 'restaurant'
  | 'electronics'
  | 'fashion'
  | 'clinic'
  | 'grocery'
  | 'jewellery'
  | 'laundry'
  | 'medicine'
  | 'food'

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

const DEFAULT_PRESET_ID: LegacyThemePresetId = 'hybrid'
const DEFAULT_PRESET_NAME = 'Hybrid Store'

/**
 * Mirrors storefront HomeOrBuilder: when no published wb_site exists, the live home
 * uses legacy Home.tsx + theme_config.template (default hybrid).
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
        'Your published Website Builder site controls the business front home. Unpublish it to use a default theme preset below.',
    }
  }

  const presetId = (themeTemplateId?.trim() || DEFAULT_PRESET_ID) as LegacyThemePresetId
  const preset = presets.find(p => p.id === presetId)
  return {
    kind: 'legacy_preset',
    id: presetId,
    name: preset?.name ?? (presetId === DEFAULT_PRESET_ID ? DEFAULT_PRESET_NAME : presetId),
    description:
      'This default layout is live on your business front when no Website Builder site is published.',
  }
}

export function isLegacyPresetActive(
  active: BusinessFrontActiveTemplate,
  presetId: string,
): boolean {
  return active.kind === 'legacy_preset' && active.id === presetId
}
