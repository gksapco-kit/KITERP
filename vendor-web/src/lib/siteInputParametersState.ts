import {
  getCoreSetupFeatures,
  getDefaultSetupFeatures,
  normalizeSetupFeatures,
  type SetupFeatureId,
} from '@/lib/businessSitePresets'
import {
  DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS,
  DEFAULT_WEBSITE_COLOR_PALETTE_ID,
  type WebsiteColorPaletteId,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'
import {
  readSiteStyleMetadata,
  resolveSiteWebsiteScope,
  WEBSITE_CREATE_BUSINESS_PRESETS,
  type WebsiteStoreScope,
} from '@/lib/websiteCreateWizardPresets'

type StoreRow = {
  id: string
  is_default?: boolean
}

export type SiteInputParametersFormState = {
  name: string
  websiteStoreScope: WebsiteStoreScope
  websiteStoreId: string
  businessType: string
  sellingMode: string
  selectedFeatures: SetupFeatureId[]
  selectedPaletteId: WebsiteColorPaletteId
  customPaletteColors: WebsitePaletteColors
}

/** Load Input parameters form state from persisted style_config (single source of truth). */
export function loadSiteInputParametersState(
  site: { name: string; style_config: Record<string, unknown> | null | undefined },
  stores: StoreRow[],
  storeCount: number,
): SiteInputParametersFormState {
  const meta = readSiteStyleMetadata(site.style_config)
  const scope = resolveSiteWebsiteScope(
    {
      website_store_scope: meta.website_store_scope,
      website_store_id: meta.website_store_id,
      website_home_store_id: meta.website_home_store_id,
      business_type: meta.business_type,
      selling_mode: meta.selling_mode,
    },
    storeCount,
  )
  const storeId = scope === 'store'
    ? (meta.website_home_store_id
      ?? meta.website_store_id
      ?? stores.find(s => s.is_default)?.id
      ?? stores[0]?.id
      ?? '')
    : ''
  const isExternal = scope === 'external'
  const businessType = meta.business_type
    ?? (isExternal ? 'none' : WEBSITE_CREATE_BUSINESS_PRESETS[0].id)
  const sellingMode = meta.selling_mode
    ?? WEBSITE_CREATE_BUSINESS_PRESETS.find(b => b.id === businessType)?.sells
    ?? 'both'
  const paletteId = (meta.color_palette_id as WebsiteColorPaletteId | undefined)
    ?? DEFAULT_WEBSITE_COLOR_PALETTE_ID
  const sc = site.style_config ?? {}

  return {
    name: site.name,
    websiteStoreScope: scope,
    websiteStoreId: storeId || '',
    businessType,
    sellingMode,
    selectedFeatures: meta.setup_features?.length
      ? normalizeSetupFeatures(meta.setup_features, businessType, sellingMode)
      : meta.creation_approach === 'scratch'
        ? getCoreSetupFeatures(businessType, sellingMode)
        : getDefaultSetupFeatures(businessType, sellingMode),
    selectedPaletteId: paletteId,
    customPaletteColors: {
      primary_color: (sc.primary_color as string) ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS.primary_color,
      secondary_color: (sc.secondary_color as string) ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS.secondary_color,
      accent_color: (sc.accent_color as string) ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS.accent_color,
      bg_color: (sc.bg_color as string) ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS.bg_color,
      surface_color: (sc.surface_color as string) ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS.surface_color,
      text_color: (sc.text_color as string) ?? DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS.text_color,
    },
  }
}
