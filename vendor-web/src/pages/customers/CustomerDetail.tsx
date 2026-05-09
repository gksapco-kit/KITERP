import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCustomer } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Loader2, Building2, MapPin, CreditCard, IndianRupee } from 'lucide-react'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id!)

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
  if (!customer) return <p className="text-center py-20 text-gray-500">Customer not found</p>

  const addr = customer.billing_address
  const hasAddress = addr && (addr.street || addr.city || addr.state || addr.pincode)
  const bal = customer.opening_balance ?? 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.full_name}</h1>
          {customer.company_name && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3.5 h-3.5" /> {customer.company_name}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
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
              <p className="text-[10px] text-gray-400">{bal > 0 ? 'Receivable' : 'Advance/Credit'}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-500">Member Since</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{formatDate(customer.created_at)}</p></CardContent>
        </Card>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-0">
          {[
            { label: 'Email', value: customer.email || '—' },
            { label: 'Phone', value: customer.phone || '—' },
            { label: 'Status', value: customer.is_active ? 'Active' : 'Inactive' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2.5 border-b last:border-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* GST / Business Identity */}
      {(customer.gstin || customer.pan_number || customer.company_name) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> GST / Business Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {customer.company_name && (
              <div className="flex justify-between py-2.5 border-b">
                <span className="text-sm text-gray-500">Trade / Company Name</span>
                <span className="text-sm font-medium">{customer.company_name}</span>
              </div>
            )}
            {customer.gstin && (
              <div className="flex justify-between py-2.5 border-b">
                <span className="text-sm text-gray-500">GSTIN</span>
                <span className="text-sm font-mono font-semibold tracking-wider text-blue-700">{customer.gstin}</span>
              </div>
            )}
            {customer.pan_number && (
              <div className="flex justify-between py-2.5">
                <span className="text-sm text-gray-500">PAN</span>
                <span className="text-sm font-mono font-semibold tracking-wider">{customer.pan_number}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing Address */}
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
    </div>
  )
}
