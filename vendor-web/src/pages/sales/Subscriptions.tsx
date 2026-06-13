import { useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useProducts, useServices } from '@/hooks/useVendor'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { customerSubscriptionsApi } from '@/api/marketplace'

function isSubscribedService(s: Record<string, unknown>): boolean {
  return !!(s.is_subscription || s.subscription_interval)
}

function isSubscribedProduct(p: Record<string, unknown>): boolean {
  const v = (p.variants as Record<string, unknown>[] | undefined)?.[0]
  return !!(v?.subscription_interval || p.is_subscription)
}

export default function SubscriptionsSalesPage() {
  const { data: servicesData, isLoading: ls } = useServices({ size: 500, status: 'active' })
  const { data: productsData, isLoading: lp } = useProducts({ size: 500, status: 'active' })
  const services = servicesData?.items ?? []
  const products = productsData?.items ?? []

  const rows = useMemo(() => {
    const svc = (services as unknown as Record<string, unknown>[]).filter(isSubscribedService).map(s => ({
      kind: 'service' as const,
      id: String(s.id),
      name: String(s.name ?? ''),
      detail: String(s.subscription_interval ?? 'subscription'),
      price: Number(s.subscription_price ?? s.price ?? 0),
    }))
    const prd = (products as unknown as Record<string, unknown>[]).filter(isSubscribedProduct).map(p => ({
      kind: 'product' as const,
      id: String(p.id),
      name: String(p.name ?? ''),
      detail: String((p.variants as any)?.[0]?.subscription_interval ?? 'subscription'),
      price: Number((p.variants as any)?.[0]?.price ?? p.price ?? 0),
    }))
    return [...svc, ...prd]
  }, [services, products])

  const { data: activeSubs = [], isLoading: la } = useQuery({
    queryKey: ['customer-subscriptions'],
    queryFn: () => customerSubscriptionsApi.list(),
  })

  const loading = ls || lp

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Subscriptions Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Services And Variants Flagged With Subscription Billing. Manage Offerings Under Products / Services.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/services">Edit services</Link>
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-gray-500 text-sm">
          No subscription items yet. Enable subscription fields on a service or variant.&nbsp;
          <Link className="text-primary font-medium" to="/services/new">Create service</Link>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Active customer subscriptions</h2>
        {la && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}
        {!la && activeSubs.length === 0 && (
          <p className="text-sm text-gray-500 border border-dashed rounded-lg p-4">No customer subscriptions yet.</p>
        )}
        {!la && activeSubs.length > 0 && (
          <div className="rounded-xl border bg-white overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Item</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Cadence</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Per cycle</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(activeSubs as Record<string, unknown>[]).map((s) => (
                  <tr key={String(s.id)}>
                    <td className="px-4 py-3">{String(s.customer_name || '—')}</td>
                    <td className="px-4 py-3 font-medium">{String(s.item_name)}</td>
                    <td className="px-4 py-3 capitalize">{String(s.interval)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(s.price_per_cycle || 0))}</td>
                    <td className="px-4 py-3 capitalize">{String(s.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-800">Subscription catalog</h2>
      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3"><TableColumnLabel>Type</TableColumnLabel></th>
              <th className="px-4 py-3"><TableColumnLabel>Name</TableColumnLabel></th>
              <th className="px-4 py-3"><TableColumnLabel>Cadence</TableColumnLabel></th>
              <th className="px-4 py-3 text-right"><TableColumnLabel>From price</TableColumnLabel></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={`${r.kind}-${r.id}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 capitalize text-gray-600">{r.kind}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-gray-600">{r.detail}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(r.price)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    className="text-primary text-xs font-medium hover:underline"
                    to={r.kind === 'service' ? `/services/${r.id}` : `/products/${r.id}`}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
