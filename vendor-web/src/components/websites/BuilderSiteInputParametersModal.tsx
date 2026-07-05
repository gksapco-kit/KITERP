import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SiteInputParametersModal } from '@/components/websites/SiteInputParametersModal'
import { websiteApi } from '@/api/websites'
import type { StyleConfig, WebsiteSite } from '@/types/websites'
import {
  getAvailableSetupFeatures,
  imageCategoryForBusinessType,
  normalizeSetupFeatures,
  resolveWebsiteSetupFromBusinessSettings,
  type SetupFeatureId,
} from '@/lib/businessSitePresets'
import { companyTypeLabel } from '@/data/companyTypes'
import {
  CUSTOM_WEBSITE_PALETTE_ID,
  DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS,
  DEFAULT_WEBSITE_COLOR_PALETTE_ID,
  resolveWebsitePaletteColors,
  type WebsiteColorPaletteId,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'
import { loadSiteInputParametersState } from '@/lib/siteInputParametersState'
import {
  readSiteStyleMetadata,
  WEBSITE_CREATE_BUSINESS_PRESETS,
  WEBSITE_SELLING_MODES,
  type WebsiteStoreScope,
} from '@/lib/websiteCreateWizardPresets'
import { extractApiError } from '@/lib/errorMessages'

type StoreRow = {
  id: string
  code?: string | null
  name?: string
  is_default?: boolean
  settings?: Record<string, unknown> | null
}

export function BuilderSiteInputParametersModal({
  open,
  onClose,
  site,
  siteId,
  stores,
  vendor,
  onStyleSaved,
}: {
  open: boolean
  onClose: () => void
  site: WebsiteSite
  siteId: string
  stores: StoreRow[]
  vendor: { business_type?: string; settings?: Record<string, unknown> } | null | undefined
  onStyleSaved: (style: StyleConfig, name: string) => void
}) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const hydratedRef = useRef(false)

  const storeCount = stores.length
  const singleStore = storeCount === 1 ? stores[0] : null
  const showStoreScopePicker = storeCount > 1

  const [name, setName] = useState(site.name)
  const [websiteStoreScope, setWebsiteStoreScope] = useState<WebsiteStoreScope>('store')
  const [websiteStoreId, setWebsiteStoreId] = useState('')
  const [businessType, setBusinessType] = useState(WEBSITE_CREATE_BUSINESS_PRESETS[0].id)
  const [sellingMode, setSellingMode] = useState(WEBSITE_CREATE_BUSINESS_PRESETS[0].sells)
  const [selectedFeatures, setSelectedFeatures] = useState<SetupFeatureId[]>([])
  const [selectedPaletteId, setSelectedPaletteId] = useState<WebsiteColorPaletteId>(DEFAULT_WEBSITE_COLOR_PALETTE_ID)
  const [customPaletteColors, setCustomPaletteColors] = useState<WebsitePaletteColors>(DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS)

  // Snapshot persisted style_config once when the modal opens — do not re-sync when
  // vendor/stores/site refetch in the background (that caused values to "flip back").
  useEffect(() => {
    if (!open) {
      hydratedRef.current = false
      return
    }
    if (hydratedRef.current) return

    const meta = readSiteStyleMetadata(site.style_config as Record<string, unknown>)
    const needsStores = meta.website_store_scope === 'store'
      && !meta.website_home_store_id
      && !meta.website_store_id
      && stores.length === 0
    if (needsStores) return

    hydratedRef.current = true
    const state = loadSiteInputParametersState(site, stores, storeCount)
    setName(state.name)
    setWebsiteStoreScope(state.websiteStoreScope)
    setWebsiteStoreId(state.websiteStoreId)
    setBusinessType(state.businessType)
    setSellingMode(state.sellingMode)
    setSelectedFeatures(state.selectedFeatures)
    setSelectedPaletteId(state.selectedPaletteId)
    setCustomPaletteColors(state.customPaletteColors)
  }, [open, site, storeCount, stores])

  const isExternalScope = websiteStoreScope === 'external'
  const activeStoreForSettings = websiteStoreScope === 'store'
    ? (websiteStoreId
      ? stores.find(s => s.id === websiteStoreId)
      : singleStore ?? stores.find(s => s.is_default) ?? stores[0])
    : undefined
  const builtForStore = websiteStoreScope === 'store'
    ? (stores.find(s => s.id === websiteStoreId) ?? singleStore)
    : null

  const settingsSetup = resolveWebsiteSetupFromBusinessSettings(vendor, activeStoreForSettings)
  const effectiveBusinessType = businessType
  const effectiveSellingMode = sellingMode
  const selectedBusiness = WEBSITE_CREATE_BUSINESS_PRESETS.find(t => t.id === effectiveBusinessType) || WEBSITE_CREATE_BUSINESS_PRESETS[0]
  const availableFeatures = getAvailableSetupFeatures(effectiveBusinessType, effectiveSellingMode)
  const settingsBusinessLabel = companyTypeLabel(
    (activeStoreForSettings?.settings as Record<string, unknown> | undefined)?.company_type as string
      || vendor?.business_type,
  )
  const settingsSellingLabel = WEBSITE_SELLING_MODES.find(s => s.id === settingsSetup.sellingMode)?.label ?? 'Both'

  const toggleFeature = useCallback((id: SetupFeatureId, locked?: boolean) => {
    if (locked) return
    setSelectedFeatures(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id],
    )
  }, [])

  const handlePaletteSelect = useCallback((id: WebsiteColorPaletteId) => {
    if (id === CUSTOM_WEBSITE_PALETTE_ID && selectedPaletteId !== CUSTOM_WEBSITE_PALETTE_ID) {
      setCustomPaletteColors(resolveWebsitePaletteColors(selectedPaletteId, customPaletteColors))
    }
    setSelectedPaletteId(id)
  }, [customPaletteColors, selectedPaletteId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const siteName = name.trim() || selectedBusiness.defaultName
      const paletteColors = resolveWebsitePaletteColors(selectedPaletteId, customPaletteColors)
      const existingStyle = site.style_config as Record<string, unknown>
      const normalizedFeatures = normalizeSetupFeatures(
        selectedFeatures,
        effectiveBusinessType,
        effectiveSellingMode,
      )
      const nextStyleConfig = {
        ...existingStyle,
        ...paletteColors,
        color_palette_id: selectedPaletteId,
        image_category_id: imageCategoryForBusinessType(effectiveBusinessType),
        business_type: effectiveBusinessType,
        selling_mode: effectiveSellingMode,
        setup_features: normalizedFeatures,
        website_store_scope: websiteStoreScope,
        website_store_id: websiteStoreScope === 'store' ? (websiteStoreId || null) : null,
        website_store_name: websiteStoreScope === 'store'
          ? (stores.find(s => s.id === websiteStoreId)?.name ?? existingStyle.website_store_name ?? null)
          : null,
        website_home_store_id: websiteStoreScope === 'store' ? (websiteStoreId || null) : null,
      }

      const updated = await websiteApi.updateSite(siteId, {
        name: siteName,
        style_config: nextStyleConfig as Partial<StyleConfig>,
      })
      queryClient.setQueryData(['websites', siteId], updated)
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      onStyleSaved({ ...updated.style_config } as StyleConfig, updated.name)
      toast.success('Template input parameters saved.')
      onClose()
    } catch (e) {
      toast.error(extractApiError(e, 'Could not save input parameters'))
    } finally {
      setSaving(false)
    }
  }, [
    customPaletteColors,
    effectiveBusinessType,
    effectiveSellingMode,
    name,
    onClose,
    onStyleSaved,
    queryClient,
    selectedBusiness.defaultName,
    selectedFeatures,
    selectedPaletteId,
    site.style_config,
    siteId,
    stores,
    websiteStoreId,
    websiteStoreScope,
  ])

  const modalProps = useMemo(() => ({
    open,
    onClose,
    disabled: saving,
    saving,
    saveLabel: 'Save parameters',
    subtitle: 'View and edit the setup inputs for this website template.',
    onSave: handleSave,
    name,
    setName,
    websiteStoreScope,
    setWebsiteStoreScope,
    websiteStoreId,
    setWebsiteStoreId,
    businessType,
    setBusinessType,
    sellingMode,
    setSellingMode,
    selectedFeatures,
    setSelectedFeatures,
    selectedPaletteId,
    customPaletteColors,
    onPaletteSelect: handlePaletteSelect,
    onCustomColorsChange: setCustomPaletteColors,
    stores,
    storeCount,
    singleStore,
    showStoreScopePicker,
    isExternalScope,
    effectiveBusinessType,
    effectiveSellingMode,
    availableFeatures,
    selectedBusiness,
    settingsBusinessLabel,
    settingsSellingLabel,
    activeStoreForSettings,
    builtForStore,
    toggleFeature,
    defaultName: selectedBusiness.defaultName,
    lockWebsiteScope: true,
  }), [
    activeStoreForSettings,
    availableFeatures,
    builtForStore,
    businessType,
    customPaletteColors,
    effectiveBusinessType,
    effectiveSellingMode,
    handlePaletteSelect,
    handleSave,
    isExternalScope,
    name,
    open,
    saving,
    selectedBusiness,
    selectedFeatures,
    selectedPaletteId,
    sellingMode,
    settingsBusinessLabel,
    settingsSellingLabel,
    showStoreScopePicker,
    singleStore,
    storeCount,
    stores,
    toggleFeature,
    websiteStoreId,
    websiteStoreScope,
  ])

  return <SiteInputParametersModal {...modalProps} />
}
