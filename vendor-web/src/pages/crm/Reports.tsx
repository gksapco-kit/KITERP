import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSalesReport, useCampaignsReport, useTicketsReport, useCrmOverview } from '@/hooks/useCrm'
import { Loader2, TrendingUp, Mail, LifeBuoy, BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type SalesReport = {
  total_pipeline?: number
  weighted_pipeline?: number
  won_value?: number
  lost_value?: number
  win_rate?: number
  by_owner?: Array<{ owner_id: string; name?: string; deals: number; value: number; won: number }>
  by_stage?: Array<{ stage: string; count: number; value: number }>
  by_month?: Array<{ month: string; won: number; created: number }>
}
type CampaignReport = {
  total_sent?: number
  total_opens?: number
  total_clicks?: number
  total_bounces?: number
  open_rate?: number
  click_rate?: number
  campaigns?: Array<{ name: string; sent: number; opens: number; clicks: number; bounces: number }>
}
type TicketReport = {
  total_open?: number
  total_resolved?: number
  avg_first_response_minutes?: number
  avg_resolution_minutes?: number
  sla_breached?: number
  by_priority?: Array<{ priority: string; count: number }>
  by_agent?: Array<{ agent: string; resolved: number; open: number }>
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function Section({ title, icon: Icon, children, loading }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : children}
      </CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const { data: overview, isLoading: l0 } = useCrmOverview() as { data?: { total_contacts?: number; total_accounts?: number; conversion_rate?: number; pipeline_value?: number }; isLoading: boolean }
  const { data: sales, isLoading: l1 } = useSalesReport() as { data?: SalesReport; isLoading: boolean }
  const { data: camps, isLoading: l2 } = useCampaignsReport() as { data?: CampaignReport; isLoading: boolean }
  const { data: tickets, isLoading: l3 } = useTicketsReport() as { data?: TicketReport; isLoading: boolean }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
      </div>

      <Section title="Overview" icon={BarChart3} loading={l0}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Contacts"     value={overview?.total_contacts ?? 0} />
          <Stat label="Accounts"     value={overview?.total_accounts ?? 0} />
          <Stat label="Conversion"   value={`${(overview?.conversion_rate ?? 0).toFixed?.(1) ?? 0}%`} />
          <Stat label="Pipeline"     value={formatCurrency(overview?.pipeline_value ?? 0)} />
        </div>
      </Section>

      <Section title="Sales performance" icon={TrendingUp} loading={l1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Pipeline"        value={formatCurrency(sales?.total_pipeline ?? 0)} hint={`Weighted ${formatCurrency(sales?.weighted_pipeline ?? 0)}`} />
          <Stat label="Won"             value={formatCurrency(sales?.won_value ?? 0)} />
          <Stat label="Lost"            value={formatCurrency(sales?.lost_value ?? 0)} />
          <Stat label="Win rate"        value={`${(sales?.win_rate ?? 0).toFixed?.(1) ?? 0}%`} />
        </div>
        {!!sales?.by_owner?.length && (
          <div>
            <p className="text-xs uppercase text-gray-500 mb-2">By owner</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase">
                    <th className="py-2">Owner</th><th>Deals</th><th>Value</th><th>Won</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sales.by_owner.map(o => (
                    <tr key={o.owner_id}><td className="py-2">{o.name || o.owner_id}</td><td>{o.deals}</td><td>{formatCurrency(o.value)}</td><td>{o.won}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title="Campaigns" icon={Mail} loading={l2}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label="Sent"      value={camps?.total_sent ?? 0} />
          <Stat label="Opens"     value={camps?.total_opens ?? 0} hint={`${(camps?.open_rate ?? 0).toFixed?.(1) ?? 0}%`} />
          <Stat label="Clicks"    value={camps?.total_clicks ?? 0} hint={`${(camps?.click_rate ?? 0).toFixed?.(1) ?? 0}%`} />
          <Stat label="Bounces"   value={camps?.total_bounces ?? 0} />
          <Stat label="Campaigns" value={camps?.campaigns?.length ?? 0} />
        </div>
        {!!camps?.campaigns?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="py-2">Name</th><th>Sent</th><th>Opens</th><th>Clicks</th><th>Bounces</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {camps.campaigns.map(c => (
                  <tr key={c.name}><td className="py-2">{c.name}</td><td>{c.sent}</td><td>{c.opens}</td><td>{c.clicks}</td><td>{c.bounces}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Tickets" icon={LifeBuoy} loading={l3}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label="Open"      value={tickets?.total_open ?? 0} />
          <Stat label="Resolved"  value={tickets?.total_resolved ?? 0} />
          <Stat label="Avg first response" value={`${tickets?.avg_first_response_minutes ?? 0}m`} />
          <Stat label="Avg resolution"     value={`${tickets?.avg_resolution_minutes ?? 0}m`} />
          <Stat label="SLA breached"       value={tickets?.sla_breached ?? 0} />
        </div>
        {!!tickets?.by_priority?.length && (
          <div className="flex gap-2 flex-wrap">
            {tickets.by_priority.map(p => <Badge key={p.priority} variant="soft">{p.priority}: {p.count}</Badge>)}
          </div>
        )}
      </Section>
    </div>
  )
}
