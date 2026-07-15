import { Link } from 'react-router-dom'
import {
  ChevronRight, Globe, Info, Layout, Pencil, ShoppingBag, ShoppingCart, Store, X,
} from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { WebsiteScopeBadge } from '@/components/websites/WebsiteScopeBadge'
import { ColorPalettePicker, SetupFeaturesPicker } from '@/components/websites/siteInputParametersPickers'
import {
  getDefaultSetupFeatures,
  type SetupFeatureId,
  type SetupFeatureOption,
} from '@/lib/businessSitePresets'
import {
  WEBSITE_CREATE_BUSINESS_PRESETS,
  WEBSITE_SELLING_MODES,
  WEBSITE_STORE_SCOPE_OPTIONS,
  type WebsiteStoreScope,
} from '@/lib/websiteCreateWizardPresets'
import {
  type WebsiteColorPaletteId,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'
import { formatStoreCode } from '@/lib/verification'

export function SiteInputParametersModal({
  open,
  onClose,
  onCloseParent,
  disabled,
  saveLabel = 'Done',
  onSave,
  saving,
  subtitle = 'Edit the inputs used to generate your website template.',
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
  onPaletteSelect,
  onCustomColorsChange,
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
  defaultName,
  lockWebsiteScope = false,
}: {
  open: boolean
  onClose: () => void
  onCloseParent?: () => void
  disabled?: boolean
  saveLabel?: string
  onSave?: () => void | Promise<void>
  saving?: boolean
  subtitle?: string
  name: string
  setName: (v: string) => void
  websiteStoreScope: WebsiteStoreScope
  setWebsiteStoreScope: (v: WebsiteStoreScope) => void
  websiteStoreId: string
  setWebsiteStoreId: (v: string) => void
  businessType: string
  setBusinessType: (v: string) => void
  sellingMode: string
  setSellingMode: (v: string) => void
  selectedFeatures: SetupFeatureId[]
  setSelectedFeatures: (v: SetupFeatureId[]) => void
  selectedPaletteId: WebsiteColorPaletteId
  customPaletteColors: WebsitePaletteColors
  onPaletteSelect: (id: WebsiteColorPaletteId) => void
  onCustomColorsChange: (colors: WebsitePaletteColors) => void
  stores: { id: string; code?: string | null; name?: string; is_default?: boolean }[]
  storeCount: number
  singleStore: { id: string; code?: string | null; name?: string } | null
  showStoreScopePicker: boolean
  isExternalScope: boolean
  effectiveBusinessType: string
  effectiveSellingMode: string
  availableFeatures: SetupFeatureOption[]
  selectedBusiness: (typeof WEBSITE_CREATE_BUSINESS_PRESETS)[number]
  settingsBusinessLabel: string
  settingsSellingLabel: string
  activeStoreForSettings: { id: string; name?: string } | undefined
  builtForStore: { id: string; name?: string; code?: string | null } | null
  toggleFeature: (id: SetupFeatureId, locked?: boolean) => void
  defaultName: string
  /** When true, scope/BU are read-only (existing sites or post–step-1 create). */
  lockWebsiteScope?: boolean
}) {
  useEscapeToClose(onClose, open)

  if (!open) return null

  const currentScopeOption = WEBSITE_STORE_SCOPE_OPTIONS.find(o => o.id === websiteStoreScope)
  const scopeFieldsDisabled = Boolean(disabled || saving || lockWebsiteScope)
  const showExternalScopeOnly = websiteStoreScope === 'external' && (lockWebsiteScope || !showStoreScopePicker)
  const showScopePicker = (showStoreScopePicker || lockWebsiteScope) && !showExternalScopeOnly
  const externalScopeOption = WEBSITE_STORE_SCOPE_OPTIONS.find(o => o.id === 'external')

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Input parameters</h2>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="params-website-name" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              Website template name
            </label>
            <input
              id="params-website-name"
              value={name}
              disabled={disabled || saving}
              onChange={e => setName(e.target.value)}
              placeholder={defaultName}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {showExternalScopeOnly ? (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                {externalScopeOption ? (
                  <externalScopeOption.icon className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Globe className="h-3.5 w-3.5 text-primary" />
                )}
                This website is for
              </label>
              <div className="relative">
                {externalScopeOption ? (
                  <externalScopeOption.icon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
                ) : null}
                <div className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm font-medium text-gray-700 shadow-sm">
                  {externalScopeOption?.label ?? 'Other Use'}
                </div>
              </div>
              {externalScopeOption ? (
                <p className="mt-1.5 text-xs text-gray-500">{externalScopeOption.desc}</p>
              ) : null}
            </div>
          ) : showScopePicker ? (
            <div>
              <label htmlFor="params-website-scope" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                <Globe className="h-3.5 w-3.5 text-primary" />
                This website is for
              </label>
              <div className="relative">
                {currentScopeOption ? (
                  <currentScopeOption.icon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
                ) : null}
                <Select
                  id="params-website-scope"
                  value={websiteStoreScope}
                  disabled={scopeFieldsDisabled}
                  onChange={(v) => setWebsiteStoreScope(v as WebsiteStoreScope)}
                  options={WEBSITE_STORE_SCOPE_OPTIONS.map(opt => ({ value: opt.id, label: opt.label }))}
                  aria-label="Website store scope"
                  className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                />
              </div>
              {currentScopeOption && (
                <p className="mt-1.5 text-xs text-gray-500">{currentScopeOption.desc}</p>
              )}
              {websiteStoreScope === 'store' && (
                <div className="mt-3">
                  <label htmlFor="params-website-bu" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Business unit
                  </label>
                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Select
                      id="params-website-bu"
                      value={websiteStoreId}
                      disabled={scopeFieldsDisabled}
                      onChange={setWebsiteStoreId}
                      options={stores.map(s => ({
                        value: s.id,
                        label: `${formatStoreCode(s)} · ${s.name}`,
                      }))}
                      aria-label="Business unit"
                      className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                    />
                  </div>
                  {builtForStore && !lockWebsiteScope ? (
                    <div className="mt-2">
                      <WebsiteScopeBadge
                        scope="store"
                        storeId={builtForStore.id}
                        storeName={builtForStore.name ?? null}
                        storeCode={formatStoreCode(builtForStore)}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : storeCount === 1 && singleStore ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Built for</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatStoreCode(singleStore)} · {singleStore.name}
              </p>
              <button
                type="button"
                disabled={disabled || saving}
                onClick={() => setWebsiteStoreScope('external')}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Switch to external marketing site
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {isExternalScope ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="params-biz-type" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <Layout className="h-3.5 w-3.5 text-primary" />
                  Business type
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-base leading-none">{selectedBusiness.icon}</span>
                  <Select
                    id="params-biz-type"
                    value={businessType}
                    disabled={disabled || saving}
                    onChange={(v) => {
                      const t = WEBSITE_CREATE_BUSINESS_PRESETS.find(b => b.id === v)
                      if (!t) return
                      setBusinessType(t.id)
                      setSellingMode(t.sells)
                    }}
                    options={WEBSITE_CREATE_BUSINESS_PRESETS.map(t => ({ value: t.id, label: `${t.icon} ${t.label}` }))}
                    aria-label="Business type"
                    className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="params-sell-mode" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                  <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                  What do you sell?
                </label>
                <div className="relative">
                  <ShoppingBag className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-blue-500" />
                  <Select
                    id="params-sell-mode"
                    value={sellingMode}
                    disabled={disabled || saving}
                    onChange={setSellingMode}
                    options={WEBSITE_SELLING_MODES.map(s => ({ value: s.id, label: s.label }))}
                    aria-label="Selling mode"
                    className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <p className="leading-relaxed">
                Business type (<strong className="font-semibold text-gray-700">{settingsBusinessLabel}</strong>) and what you sell (
                <strong className="font-semibold text-gray-700">{settingsSellingLabel}</strong>) come from{' '}
                {onCloseParent ? (
                  <Link to="/settings" className="font-medium text-primary underline underline-offset-2" onClick={onCloseParent}>Business Settings</Link>
                ) : (
                  <Link to="/settings" className="font-medium text-primary underline underline-offset-2">Business Settings</Link>
                )}
                {activeStoreForSettings ? ` for ${activeStoreForSettings.name}` : ''}.
              </p>
            </div>
          )}

          <SetupFeaturesPicker
            features={availableFeatures}
            selected={selectedFeatures}
            businessType={selectedBusiness.label}
            sellingMode={effectiveSellingMode}
            disabled={disabled || saving}
            onToggle={toggleFeature}
            onSelectRecommended={() => setSelectedFeatures(getDefaultSetupFeatures(effectiveBusinessType, effectiveSellingMode))}
          />

          <ColorPalettePicker
            selected={selectedPaletteId}
            customColors={customPaletteColors}
            disabled={disabled || saving}
            onSelect={onPaletteSelect}
            onCustomColorsChange={onCustomColorsChange}
            idPrefix="site-params-palette"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-white hover:bg-primary/90"
            disabled={disabled || saving}
            onClick={() => {
              if (onSave) void onSave()
              else onClose()
            }}
          >
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
