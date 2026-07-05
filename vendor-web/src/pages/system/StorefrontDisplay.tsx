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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {defs.map(f => (
        <label
          key={f.key}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50"
        >
          <input
            type="checkbox"
            checked={values[f.key] ?? true}
            onChange={e => onChange({ ...values, [f.key]: e.target.checked })}
            className="h-4 w-4 rounded border-input text-primary"
          />
          <span className="text-sm text-foreground">{f.label}</span>
        </label>
      ))}
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Business Front Display</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose fields per website template. When a template is assigned to a business unit, customers see only the
          fields you enable here — product data still controls whether a row appears.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <LayoutTemplate className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Website template</CardTitle>
              <p className="text-xs text-muted-foreground">
                Settings apply to business units using this template on the storefront.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {templateOptions.map(opt => (
              <option key={opt.id || 'global'} value={opt.id}>
                {opt.label}
                {opt.assignedTo?.length ? ` · ${opt.assignedTo.join(', ')}` : ''}
              </option>
            ))}
          </select>
          {selectedOption?.assignedTo?.length ? (
            <p className="text-xs text-muted-foreground">
              Assigned to: {selectedOption.assignedTo.join(', ')}
            </p>
          ) : selectedTemplateId ? (
            <p className="text-xs text-amber-700">
              Not assigned to a business unit yet — configure now so it is ready when you assign this template.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={resetTemplateDefaults}>
              Enable all fields
            </Button>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Package className="h-5 w-5" strokeWidth={2} />
                </div>
                <CardTitle className="text-base">Product Fields</CardTitle>
              </div>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => toggleAll('product', true)} className="text-primary hover:underline">
                  Show All
                </button>
                <span className="text-border">|</span>
                <button type="button" onClick={() => toggleAll('product', false)} className="text-muted-foreground hover:underline">
                  Hide All
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FieldGrid defs={PRODUCT_DISPLAY_FIELD_DEFS} values={productFields} onChange={setProductFields} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <Wrench className="h-5 w-5" strokeWidth={2} />
                </div>
                <CardTitle className="text-base">Service Fields</CardTitle>
              </div>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => toggleAll('service', true)} className="text-primary hover:underline">
                  Show All
                </button>
                <span className="text-border">|</span>
                <button type="button" onClick={() => toggleAll('service', false)} className="text-muted-foreground hover:underline">
                  Hide All
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FieldGrid defs={SERVICE_DISPLAY_FIELD_DEFS} values={serviceFields} onChange={setServiceFields} />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <SaveButton loading={updateVendor.isPending} />
        </div>
      </form>
    </div>
  )
}
