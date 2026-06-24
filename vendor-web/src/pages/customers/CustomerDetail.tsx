import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCustomer } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loading } from '@/components/common/Loading'
import { ArrowLeft, Building2, MapPin, CreditCard, Landmark, FileText } from 'lucide-react'

function cleanPartyNotes(notes?: string): string {
  if (!notes) return ''
  return notes.split('\n').filter(l => !l.startsWith('__meta__:')).join('\n').trim()
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</span>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id!)

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
  const hasBusiness = !!(customer.gstin || customer.pan_number || customer.cin || customer.company_name)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/master-data')}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.full_name}</h1>
          {customer.company_name && customer.company_name !== customer.full_name && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3.5 h-3.5" /> {customer.company_name}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-500">Total Orders</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{customer.total_orders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-500">Total Spent</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(customer.total_spent)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-500">Opening Balance</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${bal > 0 ? 'text-orange-600' : bal < 0 ? 'text-green-600' : 'text-gray-800'}`}>
              {bal !== 0 ? `${formatCurrency(Math.abs(bal))} ${bal > 0 ? 'Dr' : 'Cr'}` : '—'}
            </p>
            {bal !== 0 && (
              <p className="text-xs text-gray-400">{bal > 0 ? 'Receivable' : 'Advance/Credit'}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-500">Member Since</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatDate(customer.created_at)}</p>
            {customer.updated_at && (
              <p className="text-xs text-gray-400 mt-1">Updated {formatDate(customer.updated_at)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-0">
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone} />
          <div className="flex justify-between py-2.5 border-b last:border-0">
            <span className="text-sm text-gray-500">Status</span>
            <span className="text-sm font-medium">{customer.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </CardContent>
      </Card>

      {hasBusiness && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> GST / Business Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Trade / Company Name" value={customer.company_name} />
            <InfoRow label="GSTIN" value={customer.gstin} mono />
            <InfoRow label="PAN" value={customer.pan_number} mono />
            <InfoRow label="CIN / LLPIN" value={customer.cin} mono />
          </CardContent>
        </Card>
      )}

      {hasAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" /> Billing Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">
              {[addr?.street, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(', ')}
            </p>
          </CardContent>
        </Card>
      )}

      {hasBank && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-gray-500" /> Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Bank Name" value={customer.bank_name} />
            <InfoRow label="Account Holder" value={customer.account_holder_name} />
            <InfoRow label="Account Number" value={customer.account_number} mono />
            <InfoRow label="IFSC" value={customer.ifsc_code} mono />
            <InfoRow label="Account Type" value={customer.account_type ? customer.account_type.charAt(0).toUpperCase() + customer.account_type.slice(1) : undefined} />
          </CardContent>
        </Card>
      )}

      {notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
