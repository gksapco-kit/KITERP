import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Hash, ToggleLeft, ToggleRight, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CheckboxFieldLabel, TableColumnLabel } from '@/components/common/FieldLabel'
import { cn, formatCurrency } from '@/lib/utils'
import { modalWidthMd } from '@/lib/modalUi'
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

import { askConfirm } from '@/components/common/ConfirmProvider'
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

  const labelCls = 'text-xs'
  const fieldGap = 'space-y-1'

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-2">
      <ModalPanel className={cn(modalWidthMd, 'max-h-[calc(100dvh-1rem)]')}>
        <ModalHeader
          title={initial ? 'Edit plan' : 'New plan'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_5.5rem]">
              <div className={fieldGap}>
                <Label className={labelCls}>Plan name *</Label>
                <Input className="h-8 text-sm" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Order</Label>
                <Input className="h-8 text-sm" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Description (optional)</Label>
              <Input className="h-8 text-sm" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short summary for the storefront" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className={cn(fieldGap, 'col-span-1')}>
                <Label className={labelCls}>Price</Label>
                <Input className="h-8 text-sm" type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <Input className="h-8 text-sm" value={currency} onChange={e => setCurrency(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Period</Label>
                <Input className="h-8 text-sm" value={period} onChange={e => setPeriod(e.target.value)} placeholder="mo, yr…" />
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Features (one per line)</Label>
              <textarea
                value={featuresRaw}
                onChange={e => setFeaturesRaw(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={'Feature one\nFeature two'}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className={fieldGap}>
                <Label className={labelCls}>Button label</Label>
                <Input className="h-8 text-sm" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Button link</Label>
                <Input className="h-8 text-sm" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
              <CheckboxFieldLabel
                label="Featured"
                checked={isFeatured}
                onChange={setIsFeatured}
                labelClassName="text-xs"
              />
              <CheckboxFieldLabel
                label="Active on storefront"
                checked={isActive}
                onChange={setIsActive}
                labelClassName="text-xs"
              />
            </div>
          </ModalBody>
          <ModalFooter className="justify-end gap-2 border-0 bg-transparent px-4 py-2.5">
            <Button type="button" variant="cancel" className="h-8 px-3 text-sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-8 px-3 text-sm" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {initial ? 'Save' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
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
  const { isSaving, patchField } = useInlineFieldPatch(updatePlan)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <Hash className="h-4 w-4 shrink-0 text-primary" />
            Pricing Plans
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront packages · syncs to Website Builder pricing sections
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add plan
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
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="pricing-plans-v1" defaultWidths={[72, 180, 120, 80, 90, 90, 90, 120]}>
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Plan</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Price</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Period</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Features</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Featured</TableColumnLabel></th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium uppercase tracking-wide"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No pricing plans yet. Add your first plan to sync with the Business Website Builder.</td></tr>
                ) : rows.map(plan => (
                  <tr
                    key={plan.id}
                    className="cursor-pointer hover:bg-muted/25"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', plan }))}
                  >
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell type="number" value={plan.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {plan.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium">
                      <InlineEditCell
                        value={plan.name}
                        saving={isSaving(plan.id, 'name')}
                        validate={(v) => String(v).trim().length < 1 ? 'Name is required' : null}
                        onSave={(v) => patchField(plan.id, 'name', String(v).trim())}
                        title="Edit plan name"
                      >
                        {plan.name}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell
                        type="number"
                        value={plan.price ?? 0}
                        min={0}
                        step="0.01"
                        saving={isSaving(plan.id, 'price')}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => patchField(plan.id, 'price', Number(v) || null)}
                        title="Edit price"
                      >
                        {plan.price != null ? formatCurrency(plan.price, plan.currency) : '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell
                        value={plan.period}
                        saving={isSaving(plan.id, 'period')}
                        onSave={(v) => patchField(plan.id, 'period', String(v).trim())}
                        title="Edit billing period"
                      >
                        {plan.period}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell
                        readOnly
                        readOnlyMessage="Edit features in the full editor"
                        title="Features"
                      >
                        {plan.features?.length ?? 0}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2">
                      <InlineEditCell
                        type="select"
                        value={plan.is_featured ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Featured' },
                          { value: 'false', label: 'Not featured' },
                        ]}
                        saving={isSaving(plan.id, 'is_featured')}
                        onSave={(v) => patchField(plan.id, 'is_featured', v === 'true')}
                        title="Edit featured status"
                      >
                        {plan.is_featured ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <InlineEditCell
                        type="select"
                        value={plan.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(plan.id, 'is_active')}
                        onSave={(v) => patchField(plan.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {plan.is_active ? <span className="font-medium text-primary">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          title={plan.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: plan.id, is_active: !plan.is_active })
                          }}
                          className="rounded-md p-1 hover:bg-muted"
                        >
                          {plan.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', plan }) }}
                          className="rounded-md p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete plan "${plan.name}"?`)) deletePlan.mutate(plan.id)
                          }}
                          className="rounded-md p-1 text-destructive hover:bg-muted"
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
