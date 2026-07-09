import { useState, useMemo, useEffect, useRef } from 'react'
import { TableColumnLabel, CheckboxFieldLabel } from '@/components/common/FieldLabel'
import { BusinessUnitSelect, useResolveBuBranch } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { SalesScopeFilters } from '@/components/common/SalesScopeFilters'
import { CatalogItemPicker, type CatalogPickerItem } from '@/components/common/CatalogItemPicker'
import { useStores } from '@/hooks/useVendor'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { vendorApi } from '@/api/vendor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { Plus, Loader2, Tag, Pencil, Trash2, X, ToggleLeft, ToggleRight, Copy, Share2, Mail, MessageCircle } from 'lucide-react'

function couponShareText(c: Record<string, unknown>): string {
  const discount = c.discount_type === 'percentage'
    ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`
  const min = (c.min_order_amount as number) > 0 ? ` on orders above ₹${c.min_order_amount}` : ''
  const exp = c.expires_at ? ` (valid till ${new Date(c.expires_at as string).toLocaleDateString()})` : ''
  return `Use coupon code *${c.code}* to get ${discount}${min}${exp}!`
}

function copyCouponCode(code: string) {
  navigator.clipboard.writeText(code)
  toast.success(`Coupon code "${code}" copied!`)
}

function shareViaWhatsApp(c: Record<string, unknown>) {
  window.open(`https://wa.me/?text=${encodeURIComponent(couponShareText(c))}`, '_blank')
}

function shareViaEmail(c: Record<string, unknown>) {
  const subject = `Coupon: ${c.code} - ${c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}`
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(couponShareText(c))}`, '_blank')
}

function shareViaNative(c: Record<string, unknown>) {
  if (navigator.share) {
    navigator.share({ title: `Coupon: ${c.code}`, text: couponShareText(c) }).catch(() => {})
  } else {
    copyCouponCode(couponShareText(c))
  }
}

export default function CouponsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; coupon?: Record<string, unknown> } | null>(null)
  const [sortKey, setSortKey] = useState('code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [storeFilter, setStoreFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [salesAreaFilter, setSalesAreaFilter] = useState('')

  const { data: storesData } = useStores()
  const storeLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of storesData?.stores ?? []) m.set(s.id, s.code ? `${s.code} — ${s.name}` : s.name)
    return m
  }, [storesData])

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page, storeFilter, branchFilter],
    queryFn: () => vendorApi.listCoupons({ page, size: 20, store_id: branchFilter || storeFilter || undefined }),
  })

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => vendorApi.deleteCoupon(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon deleted') },
  })

  const toggleCoupon = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => vendorApi.updateCoupon(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon updated') },
  })

  const updateCoupon = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => vendorApi.updateCoupon(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon updated') },
    onError: (err) => toast.error(extractApiError(err, 'Could not update coupon')),
  })
  const { isSaving, patchField } = useInlineFieldPatch(updateCoupon)

  type CRow = Record<string, unknown>
  const sortAccessors: Record<string, (c: CRow) => unknown> = {
    code: (c) => c.code,
    discount_type: (c) => c.discount_type,
    discount_value: (c) => Number(c.discount_value),
    usage_count: (c) => Number(c.times_used),
    min_order_amount: (c) => Number(c.min_order_amount),
    status: (c) => (c.is_active ? 1 : 0),
    expires_at: (c) => (c.expires_at as string) || '9999-12-31',
  }
  const displayCoupons = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as CRow[],
      '',
      () => [],
      sortKey,
      sortDir,
      sortAccessors,
    )
  }, [data?.items, sortKey, sortDir])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Coupons & Promo Codes</h1>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2"><Plus className="w-4 h-4" />New Coupon</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            hint={INLINE_EDIT_HINT}
            sortOptions={[
              { value: 'code', label: 'Code' },
              { value: 'discount_type', label: 'Discount Type' },
              { value: 'discount_value', label: 'Discount Value' },
              { value: 'usage_count', label: 'Usage Count' },
              { value: 'min_order_amount', label: 'Min Order Amount' },
              { value: 'status', label: 'Status' },
              { value: 'expires_at', label: 'Expires At' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <SalesScopeFilters
            businessUnitId={storeFilter}
            branchId={branchFilter}
            salesAreaId={salesAreaFilter}
            onBusinessUnitChange={(id) => { setStoreFilter(id); setBranchFilter(''); setSalesAreaFilter(''); setPage(1) }}
            onBranchChange={(id) => { setBranchFilter(id); setSalesAreaFilter(''); setPage(1) }}
            onSalesAreaChange={(id) => { setSalesAreaFilter(id); setPage(1) }}
            className="px-4 py-2 border-b"
          />
          <div className="overflow-x-auto">
          <ResizableTable tableId="coupons-v2" defaultWidths={[150, 140, 120, 110, 80, 80, 100, 220]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Code</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Business unit</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Discount</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Min Order</TableColumnLabel></th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Used</TableColumnLabel></th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Expires</TableColumnLabel></th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-500"><Tag className="w-10 h-10 mx-auto mb-2 text-gray-200" />No coupons yet</td></tr>
              ) : displayCoupons.map((c: CRow) => (
                <tr key={c.id as string} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <InlineEditCell
                      value={String(c.code ?? '')}
                      saving={isSaving(c.id as string, 'code')}
                      onSave={(v) => patchField(c.id as string, 'code', String(v).trim().toUpperCase())}
                      title="Edit coupon code"
                      inputClassName="font-mono font-bold uppercase"
                    >
                      <span className="font-mono text-sm font-bold bg-gray-100 px-2 py-0.5 rounded">{c.code as string}</span>
                    </InlineEditCell>
                    <InlineEditCell
                      value={String(c.title ?? '')}
                      saving={isSaving(c.id as string, 'title')}
                      onSave={(v) => patchField(c.id as string, 'title', String(v).trim())}
                      title="Edit coupon title"
                    >
                      <p className="text-xs text-gray-500 mt-0.5">{c.title ? String(c.title) : '—'}</p>
                    </InlineEditCell>
                  </td>
                  <td className="px-5 py-3">
                    <InlineEditCell
                      type="select"
                      value={(c.store_id as string) || ''}
                      options={[
                        { value: '', label: 'All units' },
                        ...(storesData?.stores ?? []).map((s) => ({
                          value: s.id,
                          label: s.code ? `${s.code} — ${s.name}` : s.name,
                        })),
                      ]}
                      saving={isSaving(c.id as string, 'store_id')}
                      onSave={(v) => patchField(c.id as string, 'store_id', v || null)}
                      title="Edit business unit"
                    >
                      <span className="text-sm text-gray-600">
                        {c.store_id ? (storeLabelById.get(c.store_id as string) ?? '—') : <span className="text-gray-400">All units</span>}
                      </span>
                    </InlineEditCell>
                  </td>
                  <td className="px-5 py-3">
                    <div className="space-y-1">
                      <InlineEditCell
                        type="select"
                        value={String(c.discount_type)}
                        options={[
                          { value: 'percentage', label: 'Percentage' },
                          { value: 'fixed', label: 'Fixed amount' },
                        ]}
                        saving={isSaving(c.id as string, 'discount_type')}
                        onSave={(v) => patchField(c.id as string, 'discount_type', v)}
                        title="Edit discount type"
                      >
                        <span className="text-xs text-gray-500 capitalize">{String(c.discount_type)}</span>
                      </InlineEditCell>
                      <InlineEditCell
                        type="number"
                        value={Number(c.discount_value)}
                        min={0}
                        step="0.01"
                        saving={isSaving(c.id as string, 'discount_value')}
                        validate={(v) => Number(v) < 0 ? 'Must be 0 or more' : null}
                        onSave={(v) => patchField(c.id as string, 'discount_value', Number(v))}
                        title="Edit discount value"
                      >
                        <span className="text-sm">
                          {c.discount_type === 'percentage'
                            ? `${c.discount_value}%${c.max_discount ? ` (max ${formatCurrency(c.max_discount as number)})` : ''}`
                            : formatCurrency(c.discount_value as number)}
                        </span>
                      </InlineEditCell>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <InlineEditCell
                      type="number"
                      value={Number(c.min_order_amount) || 0}
                      min={0}
                      step="0.01"
                      saving={isSaving(c.id as string, 'min_order_amount')}
                      onSave={(v) => patchField(c.id as string, 'min_order_amount', Number(v))}
                      title="Edit minimum order amount"
                    >
                      <span className="text-sm">{(c.min_order_amount as number) > 0 ? formatCurrency(c.min_order_amount as number) : '—'}</span>
                    </InlineEditCell>
                  </td>
                  <td className="px-5 py-3">
                    <div className="space-y-1 text-center">
                      <InlineEditCell
                        type="number"
                        value={Number(c.times_used)}
                        readOnly
                        readOnlyMessage="Usage count is automatic"
                        title="Times used"
                      >
                        <span className="text-sm">{c.times_used as number}</span>
                      </InlineEditCell>
                      <InlineEditCell
                        type="number"
                        value={Number(c.usage_limit) || 0}
                        min={0}
                        step="1"
                        saving={isSaving(c.id as string, 'usage_limit')}
                        parse={(raw) => Math.max(0, Math.round(Number(raw) || 0))}
                        onSave={(v) => patchField(c.id as string, 'usage_limit', Number(v) || null)}
                        title="Edit usage limit"
                      >
                        <span className="text-xs text-gray-500">limit: {c.usage_limit ? String(c.usage_limit) : '∞'}</span>
                      </InlineEditCell>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <InlineEditCell
                      type="select"
                      value={c.is_active ? 'true' : 'false'}
                      options={[
                        { value: 'true', label: 'Active' },
                        { value: 'false', label: 'Inactive' },
                      ]}
                      saving={isSaving(c.id as string, 'is_active')}
                      onSave={(v) => patchField(c.id as string, 'is_active', v === 'true')}
                      title="Edit active status"
                    >
                      {c.is_active ? <ToggleRight className="w-6 h-6 text-green-500 mx-auto" /> : <ToggleLeft className="w-6 h-6 text-gray-400 mx-auto" />}
                    </InlineEditCell>
                  </td>
                  <td className="px-5 py-3">
                    <InlineEditCell
                      value={c.expires_at ? String(c.expires_at).slice(0, 10) : ''}
                      saving={isSaving(c.id as string, 'expires_at')}
                      onSave={(v) => patchField(c.id as string, 'expires_at', String(v).trim() ? `${String(v).trim()}T23:59:59` : null)}
                      title="Edit expiry date (YYYY-MM-DD)"
                      inputClassName="text-xs"
                    >
                      <span className="text-sm text-gray-500">{c.expires_at ? formatDate(c.expires_at as string) : 'Never'}</span>
                    </InlineEditCell>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5 justify-end">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title="Copy code" onClick={() => copyCouponCode(c.code as string)}><Copy className="w-4 h-4 text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title="Share via WhatsApp" onClick={() => shareViaWhatsApp(c)}><MessageCircle className="w-4 h-4 text-green-600" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title="Share via Email" onClick={() => shareViaEmail(c)}><Mail className="w-4 h-4 text-blue-600" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title="Share" onClick={() => shareViaNative(c)}><Share2 className="w-4 h-4 text-primary" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title="Edit" onClick={() => setModal({ mode: 'edit', coupon: c })}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-red-500" title="Delete" onClick={() => { if (confirm('Delete this coupon?')) deleteCoupon.mutate(c.id as string) }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {modal && <CouponModal mode={modal.mode} coupon={modal.coupon} onClose={() => setModal(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ['coupons'] }); setModal(null) }} />}
    </div>
  )
}

function CouponModal({
 mode, coupon, onClose, onSaved }: { mode: 'create' | 'edit'; coupon?: Record<string, unknown>; onClose: () => void; onSaved: () => void }) {
  useEscapeToClose(onClose)

  const { buId: initialBuId, branchId: initialBranchId } = useResolveBuBranch((coupon?.store_id as string) || null)

  const [form, setForm] = useState({
    code: (coupon?.code as string) || '',
    title: (coupon?.title as string) || '',
    description: (coupon?.description as string) || '',
    store_id: initialBuId,
    branch_id: initialBranchId,
    discount_type: (coupon?.discount_type as string) || 'percentage',
    discount_value: (coupon?.discount_value as number) || 10,
    max_discount: (coupon?.max_discount as number) || 0,
    min_order_amount: (coupon?.min_order_amount as number) || 0,
    usage_limit: (coupon?.usage_limit as number) || 0,
    usage_per_customer: (coupon?.usage_per_customer as number) || 1,
    applicable_to: (coupon?.applicable_to as string) || 'all',
    is_active: coupon?.is_active !== false,
    is_public: coupon?.is_public !== false,
  })

  // Coupon.store_id may point at a business unit OR a branch; once the store
  // list resolves, split it into the BU + branch pair shown below (once only,
  // so it doesn't clobber the user's own selection).
  const hydratedScopeRef = useRef(false)
  useEffect(() => {
    if (hydratedScopeRef.current || !coupon?.store_id || !initialBuId) return
    setForm((f) => ({ ...f, store_id: initialBuId, branch_id: initialBranchId }))
    hydratedScopeRef.current = true
  }, [initialBuId, initialBranchId, coupon])

  const [applicableItems, setApplicableItems] = useState<CatalogPickerItem[]>(() => {
    const raw = (coupon?.applicable_ids as unknown[]) || []
    return raw
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && 'id' in r)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name ?? r.id),
        item_type: (r.item_type === 'service' ? 'service' : 'product') as 'product' | 'service',
      }))
  })
  const [loading, setLoading] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const isSpecific = form.applicable_to === 'products' || form.applicable_to === 'services' || form.applicable_to === 'specific'

  const handleSave = async () => {
    const code = form.code.trim().toUpperCase()
    if (!code) {
      setCodeError('Coupon code is required')
      toast.error('Coupon code is required')
      return
    }
    if (code.length < 2) {
      setCodeError('Coupon code must be at least 2 characters')
      toast.error('Coupon code must be at least 2 characters')
      return
    }
    if (form.discount_value <= 0) {
      toast.error('Discount value must be greater than 0')
      return
    }
    setCodeError(null)
    setLoading(true)
    try {
      const { branch_id, store_id: formStoreId, ...rest } = form
      const payload = {
        ...rest,
        code,
        store_id: branch_id || formStoreId || undefined,
        usage_limit: form.usage_limit || undefined,
        max_discount: form.max_discount || undefined,
        applicable_ids: isSpecific ? applicableItems.map((item) => item.id) : [],
      }
      if (mode === 'create') await vendorApi.createCoupon(payload)
      else await vendorApi.updateCoupon(coupon!.id as string, payload)
      toast.success(mode === 'create' ? 'Coupon created!' : 'Coupon updated!')
      onSaved()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save coupon — check code, discount, and validity dates'))
    }
    setLoading(false)
  }

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{mode === 'create' ? 'New Coupon' : 'Edit Coupon'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label>Business unit</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              <BusinessUnitSelect
                value={form.store_id}
                onChange={(id) => { setForm(f => ({ ...f, store_id: id, branch_id: '' })); setApplicableItems([]) }}
                allowAll
                className="flex-1 min-w-[10rem]"
              />
              <BranchSelect
                businessUnitId={form.store_id || null}
                value={form.branch_id}
                onChange={(id) => setForm(f => ({ ...f, branch_id: id }))}
                allowAll
                className="flex-1 min-w-[10rem]"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Scopes which items can be selected below. "All business units" keeps it global; pick a branch to restrict further.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <Input
                className={`mt-1 font-mono uppercase ${codeError ? 'border-red-500' : ''}`}
                value={form.code}
                onChange={e => {
                  setCodeError(null)
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }}
                placeholder="SAVE20"
                minLength={2}
                disabled={mode === 'edit'}
              />
              {codeError ? (
                <p className="mt-1 text-xs text-red-600">{codeError}</p>
              ) : (
                <p className="mt-1 text-[11px] text-gray-400">At least 2 characters (e.g. RR, SAVE10)</p>
              )}
            </div>
            <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="20% Off" /></div>
          </div>
          <div><Label>Description</Label><Input className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Get 20% off on all products" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Discount Type</Label>
              <Select
                value={form.discount_type}
                onChange={(v) => setForm({ ...form, discount_type: v })}
                options={[
                  { value: 'percentage', label: 'Percentage (%)' },
                  { value: 'flat', label: 'Flat Amount (₹)' },
                ]}
                aria-label="Discount type"
                className="mt-1"
              />
            </div>
            <div><Label>Discount Value</Label><Input type="number" className="mt-1" min={0} value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max Discount (₹)</Label><Input type="number" className="mt-1" min={0} value={form.max_discount} onChange={e => setForm({ ...form, max_discount: Number(e.target.value) })} placeholder="0 = no cap" /></div>
            <div><Label>Min Order (₹)</Label><Input type="number" className="mt-1" min={0} value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Total Usage Limit</Label><Input type="number" className="mt-1" min={0} value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: Number(e.target.value) })} placeholder="0 = unlimited" /></div>
            <div><Label>Per Customer</Label><Input type="number" className="mt-1" min={1} value={form.usage_per_customer} onChange={e => setForm({ ...form, usage_per_customer: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Applies to</Label>
            <Select
              value={form.applicable_to}
              onChange={(v) => setForm({ ...form, applicable_to: v })}
              options={[
                { value: 'all', label: 'All products & services' },
                { value: 'products', label: 'Specific products' },
                { value: 'services', label: 'Specific services' },
                { value: 'specific', label: 'Specific products & services' },
              ]}
              aria-label="Applies to"
              className="mt-1"
            />
          </div>
          {isSpecific && (
            <div>
              <Label>Eligible items</Label>
              <div className="mt-1">
                <CatalogItemPicker
                  storeId={form.branch_id || form.store_id}
                  value={applicableItems}
                  onChange={setApplicableItems}
                  kinds={form.applicable_to === 'products' ? ['product'] : form.applicable_to === 'services' ? ['service'] : ['product', 'service']}
                />
              </div>
            </div>
          )}
          <div className="flex gap-6">
            <CheckboxFieldLabel label="Active" checked={form.is_active} onChange={(is_active) => setForm({ ...form, is_active })} />
            <CheckboxFieldLabel label="Visible on Store" checked={form.is_public} onChange={(is_public) => setForm({ ...form, is_public })} helpKey="visible on store" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="cancel" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || form.code.trim().length < 2 || form.discount_value <= 0} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}{mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
