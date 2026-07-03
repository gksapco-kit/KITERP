import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Hash, ToggleLeft, ToggleRight, X, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TableToolbar } from '@/components/table/TableToolbar'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { formatCurrency } from '@/lib/utils'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  usePricingPlans,
  useCreatePricingPlan,
  useUpdatePricingPlan,
  useDeletePricingPlan,
  useTogglePricingPlanActive,
} from '@/hooks/usePricingPlans'
import type { PricingPlan, PricingPlanCreate } from '@/api/pricingPlans'

function PlanModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: PricingPlan
  onClose: () => void
  onSave: (data: PricingPlanCreate) => void
  saving: boolean
}) {
  useEscapeToClose(onClose)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR')
  const [period, setPeriod] = useState(initial?.period ?? 'mo')
  const [featuresRaw, setFeaturesRaw] = useState((initial?.features ?? []).join('\n'))
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false)
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Get started')
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? '/contact')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const features = featuresRaw.split('\n').map(f => f.trim()).filter(Boolean)
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      price: price.trim() ? Number(price) : null,
      currency: currency.trim() || 'INR',
      period: period.trim() || 'mo',
      features,
      is_featured: isFeatured,
      cta_label: ctaLabel.trim() || 'Get started',
      cta_url: ctaUrl.trim() || '/contact',
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{initial ? 'Edit plan' : 'New plan'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <Label>Plan name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Price</Label>
              <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Billing period (e.g. mo, yr, order)</Label>
            <Input value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
          <div>
            <Label>Features (one per line)</Label>
            <textarea
              value={featuresRaw}
              onChange={e => setFeaturesRaw(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={'Feature one\nFeature two'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Button label</Label>
              <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
            </div>
            <div>
              <Label>Button link</Label>
              <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Sort order</Label>
            <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} />
            Featured / highlighted plan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Active on storefront
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SalesPlansPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; plan?: PricingPlan } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = usePricingPlans({ size: 100, search: search.trim() || undefined })
  const createPlan = useCreatePricingPlan()
  const updatePlan = useUpdatePricingPlan()
  const deletePlan = useDeletePricingPlan()
  const toggleActive = useTogglePricingPlanActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (plan) => [plan.name, plan.period, plan.description ?? ''],
      sortKey,
      sortDir,
      {
        sort_order: (p) => p.sort_order,
        name: (p) => p.name,
        price: (p) => p.price ?? 0,
        period: (p) => p.period,
        features: (p) => p.features?.length ?? 0,
        is_featured: (p) => (p.is_featured ? 1 : 0),
        is_active: (p) => (p.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createPlan.isPending || updatePlan.isPending

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Pricing Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage packages shown on your storefront. Plans sync automatically to Pricing Table and Pricing Tiers sections in the Business Website Builder.
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
          <Plus className="h-4 w-4" /> Add plan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search plans…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'name', label: 'Plan' },
              { value: 'price', label: 'Price' },
              { value: 'period', label: 'Period' },
              { value: 'is_active', label: 'Status' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="pricing-plans-v1" defaultWidths={[72, 180, 120, 80, 90, 90, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Plan</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Price</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Period</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Features</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Featured</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No pricing plans yet. Add your first plan to sync with the Business Website Builder.</td></tr>
                ) : rows.map(plan => (
                  <tr
                    key={plan.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', plan }))}
                  >
                    <td className="px-4 py-3 text-sm">{plan.sort_order}</td>
                    <td className="px-4 py-3 text-sm font-medium">{plan.name}</td>
                    <td className="px-4 py-3 text-sm">{plan.price != null ? formatCurrency(plan.price, plan.currency) : '—'}</td>
                    <td className="px-4 py-3 text-sm">{plan.period}</td>
                    <td className="px-4 py-3 text-sm">{plan.features?.length ?? 0}</td>
                    <td className="px-4 py-3">{plan.is_featured ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : '—'}</td>
                    <td className="px-4 py-3 text-sm">{plan.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={plan.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: plan.id, is_active: !plan.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {plan.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', plan }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm(`Delete plan "${plan.name}"?`)) deletePlan.mutate(plan.id)
                          }}
                          className="rounded p-1 hover:bg-muted text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <PlanModal
          initial={modal.mode === 'edit' ? modal.plan : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.plan) {
              updatePlan.mutate({ id: modal.plan.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createPlan.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
