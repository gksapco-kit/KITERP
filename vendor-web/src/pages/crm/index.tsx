import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCrmOverview, useActivities, useLeads, useTickets, useDeals } from '@/hooks/useCrm'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Activity, Target, LifeBuoy, Users, TrendingUp, CheckCircle2,
  Clock, AlertTriangle, ArrowRight, Loader2,
} from 'lucide-react'
import { CrmStatTile, CrmRangePicker, type CrmTrendRange } from './crmDashboardTiles'

type Overview = {
  total_contacts?: number
  total_companies?: number
  total_leads?: number
  open_leads?: number
  open_deals?: number
  pipeline_value?: number
  weighted_value?: number
  open_tickets?: number
  overdue_tickets?: number
  pending_activities?: number
  conversion_rate?: number
  trends?: Record<string, number[]>
}

export default function CrmDashboard() {
  const [range, setRange] = useState<CrmTrendRange>('30d')
  const { data: overview, isLoading } = useCrmOverview(range) as { data?: Overview; isLoading: boolean }
  const { data: leads } = useLeads({ size: 5, page: 1 })
  const { data: deals } = useDeals({ size: 5, page: 1, status: 'open' })
  const { data: tickets } = useTickets({ size: 5, page: 1, status: 'open' })
  const { data: activities } = useActivities({ size: 5, page: 1, status: 'pending' })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const o = overview || {}
  const t = o.trends || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Customer Overview</h1>
        </div>
        <div className="hidden sm:flex gap-2">
          <Link to="/crm/leads"><Badge variant="soft">{o.open_leads ?? 0} open leads</Badge></Link>
          <Link to="/crm/pipeline"><Badge variant="success">{o.open_deals ?? 0} active deals</Badge></Link>
          <Link to="/crm/tickets"><Badge variant="warning">{o.open_tickets ?? 0} open tickets</Badge></Link>
        </div>
      </div>

      <CrmRangePicker value={range} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <CrmStatTile
          label="Contacts / Companies"
          value={`${o.total_contacts ?? 0} / ${o.total_companies ?? 0}`}
          icon={Users}
          accent="blue"
          to="/crm/contacts"
          spark={t.contacts_companies}
        />
        <CrmStatTile
          label="Open leads"
          value={o.open_leads ?? 0}
          hint={`${o.total_leads ?? 0} total`}
          icon={Target}
          accent="amber"
          to="/crm/leads"
          spark={t.leads}
        />
        <CrmStatTile
          label="Conversion"
          value={`${(o.conversion_rate ?? 0).toFixed?.(1) ?? 0}%`}
          icon={TrendingUp}
          accent="green"
          spark={t.conversion}
        />
        <CrmStatTile
          label="Pipeline value"
          value={formatCurrency(o.pipeline_value ?? 0)}
          hint={`Weighted ${formatCurrency(o.weighted_value ?? 0)}`}
          icon={TrendingUp}
          accent="green"
          to="/crm/pipeline"
          spark={t.pipeline}
        />
        <CrmStatTile
          label="Active deals"
          value={o.open_deals ?? 0}
          icon={Target}
          accent="blue"
          to="/crm/pipeline"
          spark={t.deals}
        />
        <CrmStatTile
          label="Open tickets"
          value={o.open_tickets ?? 0}
          hint={`${o.overdue_tickets ?? 0} overdue`}
          icon={LifeBuoy}
          accent="rose"
          to="/crm/tickets"
          spark={t.tickets}
        />
        <CrmStatTile
          label="Pending tasks"
          value={o.pending_activities ?? 0}
          icon={Activity}
          accent="amber"
          to="/crm/activities"
          spark={t.tasks}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-amber-500" /> Recent leads</h2>
              <Link to="/crm/leads" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y">
              {leads?.items?.length ? leads.items.map(l => (
                <Link to="/crm/leads" key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || l.phone || '—'}</p>
                    <p className="text-xs text-gray-500 truncate">{l.company || l.source || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.score != null && <span className="text-xs font-mono text-gray-600">{l.score}</span>}
                    <Badge variant="soft">{l.status || 'new'}</Badge>
                  </div>
                </Link>
              )) : <p className="px-5 py-6 text-sm text-gray-400">No leads yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-blue-500" /> Active deals</h2>
              <Link to="/crm/pipeline" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Pipeline <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y">
              {deals?.items?.length ? deals.items.map(d => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {d.expected_close_date ? `Closes ${formatDateTime(d.expected_close_date)}` : 'No close date'}
                    </p>
                  </div>
                  <div className="text-sm font-semibold shrink-0">{formatCurrency(d.amount, d.currency)}</div>
                </div>
              )) : <p className="px-5 py-6 text-sm text-gray-400">No active deals.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-rose-500" /> Open tickets</h2>
              <Link to="/crm/tickets" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y">
              {tickets?.items?.length ? tickets.items.map(tk => (
                <Link to={`/crm/tickets/${tk.id}`} key={tk.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate"><span className="font-mono text-xs text-gray-400 mr-1">{tk.number}</span>{tk.subject}</p>
                    <p className="text-xs text-gray-500">Updated {formatDateTime(tk.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tk.sla_breached && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    <Badge variant={tk.priority === 'urgent' ? 'destructive' : tk.priority === 'high' ? 'warning' : 'secondary'}>{tk.priority}</Badge>
                  </div>
                </Link>
              )) : <p className="px-5 py-6 text-sm text-gray-400">No open tickets.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary/80" /> My pending tasks</h2>
              <Link to="/crm/activities" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y">
              {activities?.items?.length ? activities.items.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.number && <span className="font-mono text-xs text-gray-400 mr-1">{a.number}</span>}
                      {a.subject}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {a.type} {a.due_at ? `• due ${formatDateTime(a.due_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.status === 'pending' ? <Clock className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  </div>
                </div>
              )) : <p className="px-5 py-6 text-sm text-gray-400">No pending tasks.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
