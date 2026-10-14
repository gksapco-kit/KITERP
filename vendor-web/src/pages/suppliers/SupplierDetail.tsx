import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSupplier, usePurchaseOrders } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loading } from '@/components/common/Loading'
import {
  ArrowLeft, Building2, MapPin, Landmark, FileText, Truck, ClipboardList,
  Mail, Phone, User, Pencil, Plus, Clock, Wallet, CalendarDays, ChevronRight,
} from 'lucide-react'
import type { PurchaseOrder } from '@/types'

function cleanPartyNotes(notes?: string): string {
  if (!notes) return ''
  return notes.split('\n').filter(l => !l.startsWith('__meta__:') && !l.startsWith('===')).join('\n').trim()
}

function maskAccount(v?: string | null) {
  if (!v) return v
  return v.length <= 4 ? v : `•••• ${v.slice(-4)}`
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm ${value ? 'font-medium text-gray-900' : 'text-gray-400 italic'} ${mono && value ? 'font-mono tracking-wide' : ''}`}>
        {value || 'Not provided'}
      </p>
    </div>
  )
}

function SideCard({ icon: Icon, title, onEdit, children }: {
  icon: React.ElementType; title: string; onEdit?: () => void; children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" /> {title}
        </CardTitle>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
        )}
      </CardHeader>
      <CardContent className="pt-0 divide-y">{children}</CardContent>
    </Card>
  )
}

function Kpi({ icon: Icon, label, value, tone = 'text-gray-900' }: {
  icon: React.ElementType; label: string; value: React.ReactNode; tone?: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-lg font-bold truncate ${tone}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

const poStatusStyle: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-700',
  sent:             'bg-blue-50 text-blue-700',
  partial_received: 'bg-amber-50 text-amber-700',
  received:         'bg-green-50 text-green-700',
  closed:           'bg-gray-100 text-gray-600',
  cancelled:        'bg-red-50 text-red-600',
}

const OPEN_STATUSES = ['draft', 'sent', 'partial_received']
const PO_TABS = ['all', 'open', 'received', 'cancelled'] as const

const PARTY_TYPE_LABEL: Record<string, string> = {
  supplier:   'Supplier / Vendor',
  employee:   'Employee',
  partner:    'Partner',
  contractor: 'Contractor',
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<typeof PO_TABS[number]>('all')
  const { data: supplier, isLoading } = useSupplier(id!)
  const { data: poData } = usePurchaseOrders({ supplier_id: id!, size: 50 })
  const purchaseOrders: PurchaseOrder[] = poData?.items || []

  const stats = useMemo(() => {
    const active = purchaseOrders.filter(p => p.status !== 'cancelled')
    const open   = purchaseOrders.filter(p => OPEN_STATUSES.includes(p.status))
    const last   = [...purchaseOrders].sort((a, b) =>
      new Date(b.order_date || 0).getTime() - new Date(a.order_date || 0).getTime()
    )[0]
    return {
      count:     (poData as any)?.total ?? purchaseOrders.length,
      ordered:   active.reduce((s, p) => s + (p.total || 0), 0),
      openValue: open.reduce((s, p) => s + (p.total || 0), 0),
      openCount: open.length,
      lastDate:  last?.order_date,
    }
  }, [purchaseOrders, poData])

  const filtered = purchaseOrders.filter(p =>
    tab === 'all'      ? true
    : tab === 'open'   ? OPEN_STATUSES.includes(p.status)
    : tab === 'received' ? ['received', 'closed'].includes(p.status)
    : p.status === 'cancelled'
  )

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loading size="md" text="Loading supplier…" />
    </div>
  )
  if (!supplier) return <p className="text-center py-20 text-gray-500">Supplier not found</p>

  const addr        = supplier.address
  const addressLine = [addr?.street, addr?.city, addr?.state, addr?.postal_code, addr?.country].filter(Boolean).join(', ')
  const bal         = supplier.opening_balance ?? 0
  const notes       = cleanPartyNotes(supplier.notes)
  const initials    = supplier.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const editProfile = () => navigate(`/suppliers/${id}/edit`)

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/master-data')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0">
            {initials}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{supplier.name}</h1>
              {supplier.master_code && (
                <code className="text-xs font-mono font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {supplier.master_code}
                </code>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${supplier.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {supplier.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {PARTY_TYPE_LABEL[supplier.party_type] ?? supplier.party_type}
              </span>
              {supplier.gstin && (
                <span className="font-mono text-xs">GSTIN {supplier.gstin}</span>
              )}
              {addr?.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{addr.city}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          {supplier.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${supplier.email}`}><Mail className="w-4 h-4 mr-1" />Email</a>
            </Button>
          )}
          {supplier.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${supplier.phone}`}><Phone className="w-4 h-4 mr-1" />Call</a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={editProfile}>
            <Pencil className="w-4 h-4 mr-1" />Edit
          </Button>
          <Button size="sm" onClick={() => navigate(`/purchase-orders/new?supplier_id=${id}`)}>
            <Plus className="w-4 h-4 mr-1" />New PO
          </Button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={ClipboardList} label="Purchase Orders" value={stats.count} />
        <Kpi icon={Wallet}        label="Total Ordered"   value={formatCurrency(stats.ordered)} />
        <Kpi
          icon={Clock}
          label={`Open (${stats.openCount})`}
          value={formatCurrency(stats.openValue)}
          tone={stats.openValue > 0 ? 'text-amber-600' : 'text-gray-900'}
        />
        <Kpi icon={CalendarDays}  label="Last Order"      value={stats.lastDate ? formatDate(stats.lastDate) : '—'} />
      </div>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Purchase orders table */}
        <Card className="lg:col-span-2 h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4 text-gray-500" /> Purchase Orders
            </CardTitle>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {PO_TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
                    tab === t ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                <p>No purchase orders here yet.</p>
                <Button
                  variant="link"
                  className="mt-1"
                  onClick={() => navigate(`/purchase-orders/new?supplier_id=${id}`)}
                >
                  Create one
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-6 py-2">PO #</th>
                      <th className="text-left font-medium py-2">Date</th>
                      <th className="text-left font-medium py-2">Items</th>
                      <th className="text-left font-medium py-2">Status</th>
                      <th className="text-right font-medium px-6 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.slice(0, 10).map(po => (
                      <tr
                        key={po.id}
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3 font-semibold">#{po.po_number}</td>
                        <td className="py-3 text-gray-600">{po.order_date ? formatDate(po.order_date) : '—'}</td>
                        <td className="py-3 text-gray-600">{po.items?.length || 0}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${poStatusStyle[po.status] || 'bg-gray-100 text-gray-700'}`}>
                            {po.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-semibold">{formatCurrency(po.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filtered.length > 10 && (
              <button
                onClick={() => navigate(`/purchase-orders?supplier_id=${id}`)}
                className="w-full flex items-center justify-center gap-1 py-3 text-sm text-primary border-t hover:bg-gray-50 transition-colors"
              >
                View all {filtered.length} orders <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <SideCard icon={User} title="Contact" onEdit={editProfile}>
            <Field label="Contact Person" value={supplier.contact_name} />
            <Field label="Email"          value={supplier.email} />
            <Field label="Phone"          value={supplier.phone} />
          </SideCard>

          <SideCard icon={Building2} title="Business / GST" onEdit={editProfile}>
            {supplier.company_name && supplier.company_name !== supplier.name && (
              <Field label="Trade Name" value={supplier.company_name} />
            )}
            <Field label="GSTIN"      value={supplier.gstin}      mono />
            <Field label="PAN"        value={supplier.pan_number} mono />
            {supplier.cin && <Field label="CIN / LLPIN" value={supplier.cin} mono />}
          </SideCard>

          <SideCard icon={MapPin} title="Address" onEdit={editProfile}>
            <Field label="Registered Address" value={addressLine || null} />
          </SideCard>

          <SideCard icon={Landmark} title="Bank Details" onEdit={editProfile}>
            <Field label="Bank"            value={supplier.bank_name} />
            <Field label="Account Holder"  value={supplier.account_holder_name} />
            <Field label="Account Number"  value={maskAccount(supplier.account_number)} mono />
            <Field label="IFSC"            value={supplier.ifsc_code} mono />
            {supplier.account_type && (
              <Field label="Account Type" value={supplier.account_type.charAt(0).toUpperCase() + supplier.account_type.slice(1)} />
            )}
          </SideCard>

          {bal !== 0 && (
            <SideCard icon={Wallet} title="Opening Balance">
              <p className={`py-2 text-lg font-bold ${bal > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(bal))}{' '}
                <span className="text-xs font-medium">{bal > 0 ? 'Payable' : 'Receivable'}</span>
              </p>
            </SideCard>
          )}

          {notes && (
            <SideCard icon={FileText} title="Notes">
              <p className="py-2 text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
            </SideCard>
          )}

          <p className="text-xs text-gray-400 px-1">
            Created {formatDate(supplier.created_at)}
            {supplier.updated_at && <> · Updated {formatDate(supplier.updated_at)}</>}
          </p>
        </div>
      </div>
    </div>
  )
}
