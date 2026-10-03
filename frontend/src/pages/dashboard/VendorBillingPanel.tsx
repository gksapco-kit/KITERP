import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBillingOverview } from '@/hooks/usePlans'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

function money(amount: number | null | undefined, currency = 'INR') {
  if (amount == null) return '—'
  const symbol = currency === 'INR' ? '₹' : ''
  return `${symbol}${amount.toLocaleString()}`
}

function when(iso?: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  grace: 'bg-amber-100 text-amber-800',
  past_due: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
  none: 'bg-gray-100 text-gray-600',
  unassigned: 'bg-gray-100 text-gray-600',
  paid: 'bg-emerald-100 text-emerald-800',
}

export default function VendorBillingPanel({ paymentsOnly = false }: { paymentsOnly?: boolean }) {
  const { data, isLoading, isError } = useBillingOverview()
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const subscriptions = useMemo(() => {
    const rows = data?.subscriptions ?? []
    if (!needle) return rows
    return rows.filter((row) =>
      [row.display_name, row.business_name, row.email, row.plan_name, row.razorpay_payment_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [data?.subscriptions, needle])

  const payments = useMemo(() => {
    const rows = data?.payments ?? []
    if (!needle) return rows
    return rows.filter((row) =>
      [row.vendor_name, row.plan_name, row.razorpay_payment_id, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [data?.payments, needle])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load vendor payments. Restart the API, then refresh this page.
      </p>
    )
  }

  const totals = data?.totals

  return (
    <div className="space-y-5">
      {paymentsOnly ? null : (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total collected', value: money(totals?.collected, totals?.currency) },
          { label: 'Payments', value: String(totals?.payment_count ?? 0) },
          { label: 'Active plans', value: String(totals?.active_subscriptions ?? 0) },
          { label: 'Expired / grace', value: `${totals?.expired ?? 0} / ${totals?.in_grace ?? 0}` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {paymentsOnly || (totals?.by_plan ?? []).length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {totals?.by_plan.map((plan) => (
            <span key={plan.slug} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
              <strong>{plan.name}</strong> · {plan.vendors} vendor{plan.vendors === 1 ? '' : 's'} · {money(plan.collected)}
            </span>
          ))}
        </div>
      )}

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search vendor, plan, or payment id"
        className="max-w-sm"
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Vendor payments</h2>
        <p className="text-xs text-gray-500">Every plan payment made by a vendor, including amount, dates, and Razorpay ids.</p>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Payment id</th>
                <th className="px-3 py-2 font-medium">Order id</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                    No vendor payments yet. A row appears here after Razorpay confirms a plan payment.
                  </td>
                </tr>
              ) : (
                payments.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-600">{when(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <Link to={`/dashboard/vendors/${row.vendor_id}`} className="font-medium text-blue-700 hover:underline">
                        {row.vendor_name}
                      </Link>
                      <p className="text-[11px] text-gray-400">{row.vendor_email || row.business_name}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-800">{row.plan_name || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{money(row.amount, row.currency)}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {when(row.period_start)} – {when(row.period_end)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[row.status] || STATUS_STYLE.none}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">{row.razorpay_payment_id || '—'}</td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">{row.razorpay_order_id || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {paymentsOnly ? null : (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Vendor subscriptions</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">Last payment</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                    No vendor subscriptions yet.
                  </td>
                </tr>
              ) : (
                subscriptions.map((row) => {
                  const mode = row.access_mode || row.billing_status || 'none'
                  return (
                    <tr key={row.vendor_id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <Link to={`/dashboard/vendors/${row.vendor_id}`} className="font-medium text-blue-700 hover:underline">
                          {row.display_name || row.business_name}
                        </Link>
                        <p className="text-[11px] text-gray-400">{row.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800">{row.plan_name || '—'}</p>
                        <p className="text-[11px] text-gray-400">
                          {row.price_monthly != null ? `${money(row.price_monthly, row.currency)}/mo` : ''}
                          {row.max_apps != null ? ` · ${row.max_apps < 0 ? 'all apps' : `${row.max_apps} apps`}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[mode] || STATUS_STYLE.none}`}>
                          {mode.replace('_', ' ')}
                        </span>
                        {row.days_left != null ? (
                          <p className="mt-1 text-[11px] text-gray-400">
                            {row.days_left >= 0 ? `${row.days_left} days left` : `${Math.abs(row.days_left)} days overdue`}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {when(row.period_start)} – {when(row.period_end)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{when(row.plan_expires_at)}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800">
                          {row.last_payment_amount != null ? money(row.last_payment_amount, row.currency) : '—'}
                        </p>
                        <p className="text-[11px] text-gray-400">{when(row.last_payment_at)}</p>
                        {row.razorpay_payment_id ? (
                          <p className="text-[10px] text-gray-400">{row.razorpay_payment_id}</p>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  )
}
