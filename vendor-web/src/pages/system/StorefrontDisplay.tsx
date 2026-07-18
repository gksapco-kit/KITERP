import { useState, useEffect, useRef, useMemo } from 'react'
import { useUpdateVendor } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { useWebsiteTemplates, useSiteList } from '@/hooks/useWebsites'
import { useStores } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2, Package, Wrench, LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'
import type { Vendor } from '@/types'
import {
  DISPLAY_FIELDS_BY_TEMPLATE_KEY,
  PRODUCT_DISPLAY_FIELD_DEFS,
  SERVICE_DISPLAY_FIELD_DEFS,
  createDefaultTemplateDisplayFields,
  readDisplayFieldsByTemplate,
  resolveTemplateDisplayFieldsFromSettings,
  type TemplateDisplayFields,
} from '@/lib/storefrontDisplayFields'
import {
  resolveSingleFrontTemplateId,
  resolveStoreFrontTemplateId,
  resolveStorefrontTemplateMode,
} from '@/lib/liveStorefrontUrl'
import { resolveTemplateDisplay } from '@/lib/websiteAppliedTemplate'
import { formatStoreCode, sortStoresByCode } from '@/lib/verification'

const GLOBAL_TEMPLATE_ID = ''

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save Changes
    </Button>
  )
}

function FieldGrid({
  defs,
  values,
  onChange,
}: {
  defs: ReadonlyArray<{ key: string; label: string }>
  values: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
      {defs.map(f => (
        <label
          key={f.key}
          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50"
        >
          <input
            type="checkbox"
            checked={values[f.key] ?? true}
            onChange={e => onChange({ ...values, [f.key]: e.target.checked })}
            className="h-3.5 w-3.5 shrink-0 rounded border-input text-primary"
          />
          <span className="text-xs leading-snug text-foreground">{f.label}</span>
        </label>
      ))}
    </div>
  )
}

function SectionToggle({
  onShowAll,
  onHideAll,
}: {
  onShowAll: () => void
  onHideAll: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <button type="button" onClick={onShowAll} className="text-primary hover:text-primary/80">
        Show All
      </button>
      <span className="text-border">|</span>
      <button type="button" onClick={onHideAll} className="text-muted-foreground hover:text-foreground">
        Hide All
      </button>
    </div>
  )
}

export default function StorefrontDisplayPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const { data: templates = [] } = useWebsiteTemplates()
  const { data: sites = [] } = useSiteList()
  const { data: storesData } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []

  const [selectedTemplateId, setSelectedTemplateId] = useState(GLOBAL_TEMPLATE_ID)
  const [productFields, setProductFields] = useState<Record<string, boolean>>({})
  const [serviceFields, setServiceFields] = useState<Record<string, boolean>>({})
  const savingRef = useRef(false)
  const didAutoSelectTemplateRef = useRef(false)

  const templateMode = resolveStorefrontTemplateMode(vendor?.settings)
  const singleTemplateId = resolveSingleFrontTemplateId(vendor?.settings)

  const templateOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; assignedTo?: string[] }> = [
      { id: GLOBAL_TEMPLATE_ID, label: 'Global default (fallback)' },
    ]
    const seen = new Set<string>()

    const addOption = (id: string, label: string, assignedTo: string[] = []) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      options.push({ id, label, assignedTo })
    }

    for (const tpl of templates) {
      const assigned = sortStoresByCode(stores)
        .filter(s => resolveStoreFrontTemplateId(s.settings) === tpl.id)
        .map(s => formatStoreCode(s))
      addOption(tpl.id, tpl.name, assigned)
    }

    for (const site of sites) {
      if (!site.is_published) continue
      const assigned = sortStoresByCode(stores)
        .filter(s => resolveStoreFrontTemplateId(s.settings) === site.id)
        .map(s => formatStoreCode(s))
      const label = resolveTemplateDisplay(site.id, templates, [], sites)?.name ?? site.name
      addOption(site.id, label, assigned)
    }

    if (singleTemplateId && !seen.has(singleTemplateId)) {
      const label =
        resolveTemplateDisplay(singleTemplateId, templates, [], sites)?.name
        ?? 'Shared website template'
      addOption(singleTemplateId, label, sortStoresByCode(stores).map(s => formatStoreCode(s)))
    }

    return options
  }, [templates, sites, stores, singleTemplateId])

  useEffect(() => {
    if (!vendor || savingRef.current) return
    const resolved = resolveTemplateDisplayFieldsFromSettings(
      vendor.settings as Record<string, unknown>,
      selectedTemplateId || null,
    )
    setProductFields(resolved.product)
    setServiceFields(resolved.service)
  }, [vendor, selectedTemplateId])

  useEffect(() => {
    if (!vendor || didAutoSelectTemplateRef.current) return
    const preferred =
      templateMode === 'single' && singleTemplateId
        ? singleTemplateId
        : templateOptions.find(o => o.id && o.assignedTo && o.assignedTo.length > 0)?.id
    if (preferred) {
      setSelectedTemplateId(preferred)
      didAutoSelectTemplateRef.current = true
    }
  }, [vendor, templateMode, singleTemplateId, templateOptions])

  const selectedOption = templateOptions.find(o => o.id === selectedTemplateId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true

    const payload: Record<string, unknown> = { ...existingSettings }
    const entry: TemplateDisplayFields = { product: productFields, service: serviceFields }

    if (selectedTemplateId === GLOBAL_TEMPLATE_ID) {
      payload.display_fields = entry
    } else {
      payload[DISPLAY_FIELDS_BY_TEMPLATE_KEY] = {
        ...readDisplayFieldsByTemplate(existingSettings),
        [selectedTemplateId]: entry,
      }
    }
    updateVendor.mutate({ settings: payload } as Partial<Vendor>, {
      onSuccess: () => toast.success('Business Front display updated'),
      onSettled: () => {
        savingRef.current = false
      },
    })
  }

  const toggleAll = (type: 'product' | 'service', value: boolean) => {
    if (type === 'product') {
      setProductFields(Object.fromEntries(PRODUCT_DISPLAY_FIELD_DEFS.map(f => [f.key, value])))
    } else {
      setServiceFields(Object.fromEntries(SERVICE_DISPLAY_FIELD_DEFS.map(f => [f.key, value])))
    }
  }

  const resetTemplateDefaults = () => {
    const defaults = createDefaultTemplateDisplayFields()
    setProductFields(defaults.product)
    setServiceFields(defaults.service)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-7xl space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Business Front Display</h1>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Choose fields per website template. Customers see only the fields you enable here.
          </p>
        </div>
        <div className="shrink-0">
          <SaveButton loading={updateVendor.isPending} />
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-0 p-3 pb-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                <LayoutTemplate className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm">Website template</CardTitle>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Settings apply to business units using this template on the storefront.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={resetTemplateDefaults}>
              Enable all fields
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 p-3 pt-0">
          <select
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {templateOptions.map(opt => (
              <option key={opt.id || 'global'} value={opt.id}>
                {opt.label}
                {opt.assignedTo?.length ? ` · ${opt.assignedTo.join(', ')}` : ''}
              </option>
            ))}
          </select>
          {selectedOption?.assignedTo?.length ? (
            <p className="text-[11px] text-muted-foreground">
              Assigned to: {selectedOption.assignedTo.join(', ')}
            </p>
          ) : selectedTemplateId ? (
            <p className="text-[11px] text-amber-700">
              Not assigned to a business unit yet — configure now so it is ready when you assign this template.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader className="space-y-0 p-3 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Package className="h-4 w-4" strokeWidth={2} />
                </div>
                <CardTitle className="text-sm">Product Fields</CardTitle>
              </div>
              <SectionToggle
                onShowAll={() => toggleAll('product', true)}
                onHideAll={() => toggleAll('product', false)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <FieldGrid defs={PRODUCT_DISPLAY_FIELD_DEFS} values={productFields} onChange={setProductFields} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 p-3 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Wrench className="h-4 w-4" strokeWidth={2} />
                </div>
                <CardTitle className="text-sm">Service Fields</CardTitle>
              </div>
              <SectionToggle
                onShowAll={() => toggleAll('service', true)}
                onHideAll={() => toggleAll('service', false)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <FieldGrid defs={SERVICE_DISPLAY_FIELD_DEFS} values={serviceFields} onChange={setServiceFields} />
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
