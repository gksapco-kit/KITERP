import { useState, useMemo } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vendorApi } from '@/api/vendor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ResizableTable } from '@/components/table/ResizableTable'
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

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page],
    queryFn: () => vendorApi.listCoupons({ page, size: 20 }),
  })

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => vendorApi.deleteCoupon(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon deleted') },
  })

  const toggleCoupon = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => vendorApi.updateCoupon(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon updated') },
  })

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
          <ResizableTable tableId="coupons" defaultWidths={[150, 120, 110, 80, 80, 120, 80]}>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Min Order</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase">Used</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-500"><Tag className="w-10 h-10 mx-auto mb-2 text-gray-200" />No coupons yet</td></tr>
              ) : displayCoupons.map((c: CRow) => (
                <tr key={c.id as string} className="hover:bg-gray-50">
                  <td className="px-5 py-3"><span className="font-mono text-sm font-bold bg-gray-100 px-2 py-0.5 rounded">{c.code as string}</span>{c.title != null && c.title !== '' && <p className="text-xs text-gray-500 mt-0.5">{String(c.title)}</p>}</td>
                  <td className="px-5 py-3 text-sm">{c.discount_type === 'percentage' ? `${c.discount_value}%${c.max_discount ? ` (max ${formatCurrency(c.max_discount as number)})` : ''}` : formatCurrency(c.discount_value as number)}</td>
                  <td className="px-5 py-3 text-sm">{(c.min_order_amount as number) > 0 ? formatCurrency(c.min_order_amount as number) : '-'}</td>
                  <td className="px-5 py-3 text-sm text-center">{c.times_used as number}{c.usage_limit ? `/${c.usage_limit}` : ''}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleCoupon.mutate({ id: c.id as string, is_active: !(c.is_active as boolean) })}>
                      {c.is_active ? <ToggleRight className="w-6 h-6 text-green-500 mx-auto" /> : <ToggleLeft className="w-6 h-6 text-gray-400 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">{c.expires_at ? formatDate(c.expires_at as string) : 'Never'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-0.5 justify-end">
                      <Button variant="ghost" size="sm" title="Copy code" onClick={() => copyCouponCode(c.code as string)}><Copy className="w-4 h-4 text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" title="Share via WhatsApp" onClick={() => shareViaWhatsApp(c)}><MessageCircle className="w-4 h-4 text-green-600" /></Button>
                      <Button variant="ghost" size="sm" title="Share via Email" onClick={() => shareViaEmail(c)}><Mail className="w-4 h-4 text-blue-600" /></Button>
                      <Button variant="ghost" size="sm" title="Share" onClick={() => shareViaNative(c)}><Share2 className="w-4 h-4 text-primary" /></Button>
                      <Button variant="ghost" size="sm" title="Edit" onClick={() => setModal({ mode: 'edit', coupon: c })}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500" title="Delete" onClick={() => { if (confirm('Delete this coupon?')) deleteCoupon.mutate(c.id as string) }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResizableTable>
        </CardContent>
      </Card>

      {modal && <CouponModal mode={modal.mode} coupon={modal.coupon} onClose={() => setModal(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ['coupons'] }); setModal(null) }} />}
    </div>
  )
}

function CouponModal({
 mode, coupon, onClose, onSaved }: { mode: 'create' | 'edit'; coupon?: Record<string, unknown>; onClose: () => void; onSaved: () => void }) {
  useEscapeToClose(onClose)

  const [form, setForm] = useState({
    code: (coupon?.code as string) || '',
    title: (coupon?.title as string) || '',
    description: (coupon?.description as string) || '',
    discount_type: (coupon?.discount_type as string) || 'percentage',
    discount_value: (coupon?.discount_value as number) || 10,
    max_discount: (coupon?.max_discount as number) || 0,
    min_order_amount: (coupon?.min_order_amount as number) || 0,
    usage_limit: (coupon?.usage_limit as number) || 0,
    usage_per_customer: (coupon?.usage_per_customer as number) || 1,
    is_active: coupon?.is_active !== false,
    is_public: coupon?.is_public !== false,
  })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload = { ...form, usage_limit: form.usage_limit || undefined, max_discount: form.max_discount || undefined }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{mode === 'create' ? 'New Coupon' : 'Edit Coupon'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input className="mt-1 font-mono uppercase" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" disabled={mode === 'edit'} /></div>
            <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="20% Off" /></div>
          </div>
          <div><Label>Description</Label><Input className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Get 20% off on all products" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Discount Type</Label>
              <select className="w-full mt-1 text-sm border rounded-lg px-3 py-2" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                <option value="percentage">Percentage (%)</option><option value="flat">Flat Amount (₹)</option>
              </select>
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
          <div className="flex gap-6">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Active</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Visible on Store</span></label>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="cancel" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || !form.code} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}{mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
