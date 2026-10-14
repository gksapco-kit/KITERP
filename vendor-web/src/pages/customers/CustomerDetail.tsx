import { useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCustomer, useSalesAreas } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loading } from '@/components/common/Loading'
import { ArrowLeft, Building2, MapPin, CreditCard, Landmark, FileText, Tag, Pencil, Truck } from 'lucide-react'
import { CUSTOMER_PRICING_GROUPS } from '@/lib/customerGroups'
import { AddPartyModal } from '@/components/parties/AddPartyModal'

function cleanPartyNotes(notes?: string): string {
  if (!notes) return ''
  return notes.split('\n').filter(l => !l.startsWith('__meta__:')).join('\n').trim()
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right truncate ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</span>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
  empty,
  onAdd,
  className = '',
}: {
  title: string
  icon?: ReactNode
  children?: ReactNode
  empty?: string
  onAdd?: () => void
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-border bg-card px-3.5 py-2.5 min-h-0 flex flex-col ${className}`}>
      <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
        {icon}
        <h3 className="text-xs font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children ?? (
          <p className="text-xs text-gray-400 italic">
            {empty}{' '}
            {onAdd && (
              <button type="button" className="text-indigo-500 hover:underline not-italic" onClick={onAdd}>
                Add now
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id!)
  const { data: salesAreaData } = useSalesAreas({ is_active: true })
  const [editing, setEditing] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loading size="md" text="Loading customer…" />
      </div>
    )
  }
  if (!customer) return <p className="text-center py-20 text-gray-500">Customer not found</p>

  const addr = customer.billing_address
  const hasAddress = addr && (addr.street || addr.city || addr.state || addr.pincode)
  const bal = customer.opening_balance ?? 0
  const notes = cleanPartyNotes(customer.notes)
  const hasBank = !!(customer.bank_name || customer.account_number || customer.account_holder_name || customer.ifsc_code)
  const hasBusiness = !!(
    customer.gstin ||
    customer.pan_number ||
    customer.cin ||
    customer.company_name ||
    customer.wholesale_license_number
  )
  const shippingAddrs: Array<Record<string, string>> = Array.isArray(customer.shipping_addresses)
    ? (customer.shipping_addresses as Array<Record<string, string>>).filter(
        a => a && (a.street || a.city || a.state || a.pincode)
      )
    : []

  const salesAreaLabel = customer.sales_area_id
    ? (() => {
        const area = (salesAreaData?.sales_areas ?? []).find((a) => a.id === customer.sales_area_id)
        if (!area) return 'Assigned'
        const raw = (area.name || '').trim()
        const name = raw && raw.toLowerCase() !== 'null' ? raw : ''
        return name || area.code || 'Assigned'
      })()
    : 'Unassigned'

  const openEdit = () => setEditing(true)

  return (
    <div className="h-[calc(100vh-7rem)] max-w-5xl mx-auto flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={() => navigate('/master-data')}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{customer.full_name}</h1>
              {customer.master_code && (
                <code className="text-xs font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                  {customer.master_code}
                </code>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                <Tag className="w-3 h-3" />
                {CUSTOMER_PRICING_GROUPS.find(g => g.value === (customer.customer_group || 'retail'))?.label || 'Retail'}
              </span>
            </div>
            {customer.company_name && customer.company_name !== customer.full_name && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="w-3 h-3 shrink-0" /> {customer.company_name}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={openEdit}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
        </Button>
      </div>

      {/* Compact stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {[
          { label: 'Total Orders', value: String(customer.total_orders ?? 0) },
          { label: 'Total Spent', value: formatCurrency(customer.total_spent) },
          {
            label: 'Opening Balance',
            value: bal !== 0 ? `${formatCurrency(Math.abs(bal))} ${bal > 0 ? 'Dr' : 'Cr'}` : '—',
            className: bal > 0 ? 'text-orange-600' : bal < 0 ? 'text-green-600' : undefined,
          },
          {
            label: 'Member Since',
            value: formatDate(customer.created_at),
            sub: customer.updated_at ? `Updated ${formatDate(customer.updated_at)}` : undefined,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</p>
            <p className={`text-base font-bold leading-tight mt-0.5 ${s.className || ''}`}>{s.value}</p>
            {s.sub && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Detail sections — 2-column grid fills remaining viewport */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 min-h-0 content-start">
        <Section title="Contact Information">
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone} />
          <InfoRow label="Sales Area" value={salesAreaLabel} />
          <div className="flex justify-between gap-3 py-1">
            <span className="text-xs text-gray-500">Status</span>
            <span className="text-xs font-medium">{customer.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </Section>

        <Section
          title="GST / Business Details"
          icon={<CreditCard className="w-3.5 h-3.5 text-blue-600" />}
          empty="No GST or business details added."
          onAdd={!hasBusiness ? openEdit : undefined}
        >
          {hasBusiness ? (
            <>
              <InfoRow label="Trade / Company" value={customer.company_name} />
              <InfoRow label="GSTIN" value={customer.gstin} mono />
              <InfoRow label="PAN" value={customer.pan_number} mono />
              <InfoRow label="CIN / LLPIN" value={customer.cin} mono />
              <InfoRow label="Wholesale license" value={customer.wholesale_license_number} mono />
              <InfoRow
                label="License expires"
                value={customer.wholesale_license_expires ? formatDate(customer.wholesale_license_expires) : null}
              />
            </>
          ) : undefined}
        </Section>

        <Section
          title="Billing Address"
          icon={<MapPin className="w-3.5 h-3.5 text-gray-500" />}
          empty="No billing address added."
          onAdd={!hasAddress ? openEdit : undefined}
        >
          {hasAddress ? (
            <p className="text-xs text-gray-700 leading-snug">
              {[addr?.street, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(', ')}
            </p>
          ) : undefined}
        </Section>

        <Section
          title="Bank Details"
          icon={<Landmark className="w-3.5 h-3.5 text-gray-500" />}
          empty="No bank details added."
          onAdd={!hasBank ? openEdit : undefined}
        >
          {hasBank ? (
            <>
              <InfoRow label="Bank Name" value={customer.bank_name} />
              <InfoRow label="Account Holder" value={customer.account_holder_name} />
              <InfoRow label="Account Number" value={customer.account_number} mono />
              <InfoRow label="IFSC" value={customer.ifsc_code} mono />
              <InfoRow
                label="Account Type"
                value={customer.account_type ? customer.account_type.charAt(0).toUpperCase() + customer.account_type.slice(1) : undefined}
              />
            </>
          ) : undefined}
        </Section>

        {shippingAddrs.length > 0 && (
          <Section title="Shipping Addresses" icon={<Truck className="w-3.5 h-3.5 text-gray-500" />}>
            <div className="space-y-1.5">
              {shippingAddrs.map((sa, i) => (
                <div key={i} className={`text-xs text-gray-700 leading-snug ${i < shippingAddrs.length - 1 ? 'pb-1.5 border-b' : ''}`}>
                  {sa.label && <p className="font-medium text-gray-800 mb-0.5">{sa.label}</p>}
                  <p>{[sa.street, sa.city, sa.state, sa.pincode].filter(Boolean).join(', ')}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Notes"
          icon={<FileText className="w-3.5 h-3.5 text-gray-500" />}
          empty="No notes added."
          onAdd={!notes ? openEdit : undefined}
          className={shippingAddrs.length === 0 ? 'md:col-span-2' : ''}
        >
          {notes ? (
            <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3">{notes}</p>
          ) : undefined}
        </Section>
      </div>

      {editing && (
        <AddPartyModal
          editRecord={{ raw: customer, kind: 'customer' }}
          onClose={() => setEditing(false)}
          onCreated={() => setEditing(false)}
        />
      )}
    </div>
  )
}
