import { useNavigate } from 'react-router-dom'
import { Plus, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAm, useAssetPerms, type Row } from './api'
import { ErrorNote, Loading, PageHeader, Panel, Stat, StatusBadge, fmtDateTime, money, titleCase } from './ui'

function Bar({ label, count, value, max }: { label: string; count: number; value?: number; max: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground">{count}{value ? ` · ${money(value)}` : ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.max(4, (count / max) * 100) : 0}%` }} />
      </div>
    </div>
  )
}

export default function AssetsDashboard() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const { data, isLoading, error } = useAm<Row>('/dashboard')

  if (isLoading) return <Loading />
  if (error || !data) return <ErrorNote error={error} />

  const t = data.totals ?? {}
  const a = data.attention ?? {}
  const ap = data.approvals ?? {}
  const fin = data.finance as Row | undefined
  const byCat: Row[] = data.by_category ?? []
  const catMax = Math.max(1, ...byCat.map((c) => c.count))
  const statuses = Object.entries(t.by_status ?? {}) as [string, number][]

  type Attn = { label: string; n: number; to: string; tone: 'red' | 'amber' }
  const attention: Attn[] = ([
    { label: 'Overdue returns', n: a.overdue_returns, to: '/assets/custody', tone: 'red' },
    { label: 'Overdue work orders', n: a.overdue_work_orders, to: '/assets/maintenance', tone: 'red' },
    { label: 'Expired cover', n: a.coverage_expired, to: '/assets/coverage', tone: 'red' },
    { label: 'Lost assets', n: a.lost_assets, to: '/assets/register?status=lost', tone: 'red' },
    { label: 'Maintenance due (7 days)', n: a.maintenance_plans_due, to: '/assets/maintenance', tone: 'amber' },
    { label: 'Cover expiring (30 days)', n: a.coverage_expiring, to: '/assets/coverage', tone: 'amber' },
    { label: 'Licences expiring', n: a.licenses_expiring, to: '/assets/licenses', tone: 'amber' },
    { label: 'Awaiting acknowledgement', n: a.unacknowledged, to: '/assets/custody', tone: 'amber' },
    { label: 'Idle for 90+ days', n: a.idle_assets, to: '/assets/register?status=in_stock', tone: 'amber' },
    { label: 'Open audits', n: a.open_audits, to: '/assets/audits', tone: 'amber' },
  ] as Attn[]).filter((x) => x.n > 0)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Asset Management"
        subtitle="Where every asset is, who has it, and what it needs next."
        actions={
          <>
            <Button variant="outline" onClick={() => nav('/assets/scan')}><QrCode className="h-4 w-4" /> Scan</Button>
            {perms.manage ? <Button onClick={() => nav('/assets/register/new')}><Plus className="h-4 w-4" /> Register asset</Button> : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active assets" value={t.assets ?? 0} to={() => nav('/assets/register')} />
        <Stat label="Total cost" value={money(t.value)} />
        <Stat label="Maintenance cost (30 days)" value={money(data.maintenance_cost_30d)} />
        <Stat label="Pending approvals" value={(ap.transfers_pending ?? 0) + (ap.requests_pending ?? 0)} tone={(ap.transfers_pending ?? 0) + (ap.requests_pending ?? 0) ? 'amber' : undefined} to={() => nav('/assets/transfers')} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Needs attention">
            {attention.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {attention.map((x) => (
                  <button key={x.label} type="button" onClick={() => nav(x.to)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-accent">
                    <span>{x.label}</span>
                    <span className={x.tone === 'red' ? 'font-semibold text-red-600' : 'font-semibold text-amber-600'}>{x.n}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
            )}
          </Panel>

          <Panel title="By category">
            {byCat.length ? <div className="space-y-3">{byCat.map((c) => <Bar key={c.name} label={c.name} count={c.count} value={c.value} max={catMax} />)}</div> : <p className="text-sm text-muted-foreground">No assets registered yet.</p>}
          </Panel>

          <Panel title="Recent activity">
            {(data.recent_activity ?? []).length ? (
              <ul className="divide-y divide-border">
                {(data.recent_activity as Row[]).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <button type="button" className="text-left hover:underline" onClick={() => nav(`/assets/register/${e.asset_id}`)}>
                      <span className="font-mono font-semibold">{e.asset_tag}</span> · {e.summary || titleCase(e.event_type)}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Status">
            <div className="space-y-2">
              {statuses.length ? statuses.map(([s, n]) => (
                <div key={s} className="flex items-center justify-between text-sm">
                  <StatusBadge value={s} /><span>{n}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">No assets yet.</p>}
            </div>
          </Panel>

          {data.last_audit ? (
            <Panel title="Last audit" actions={<Button variant="link" size="sm" onClick={() => nav(`/assets/audits/${data.last_audit.id}`)}>Open</Button>}>
              <div className="text-sm font-medium">{data.last_audit.name}</div>
              <div className="mt-1 text-3xl font-bold">{data.last_audit.accuracy_pct}%</div>
              <div className="text-xs text-muted-foreground">accuracy · {data.last_audit.variance} variance(s) · {fmtDateTime(data.last_audit.completed_at)}</div>
            </Panel>
          ) : null}

          {fin ? (
            <Panel title="Finance link" actions={perms.finance ? <Button variant="link" size="sm" onClick={() => nav('/finance/assets')}>Fixed assets</Button> : undefined}>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Capitalised</dt><dd>{fin.capitalized} / {fin.active_assets}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Cost</dt><dd>{money(fin.total_cost)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Accumulated depreciation</dt><dd>{money(fin.accumulated_depreciation)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Net book value</dt><dd>{money(fin.net_book_value)}</dd></div>
              </dl>
              {fin.finance_assets_not_in_module > 0 ? (
                <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {fin.finance_assets_not_in_module} Finance asset(s) are not in the register yet.
                  {perms.finance ? <> Open the register and use “Import from Finance”.</> : null}
                </p>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Approvals">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Transfers waiting</dt><dd>{ap.transfers_pending ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Transfers in transit</dt><dd>{ap.transfers_in_transit ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Requests waiting</dt><dd>{ap.requests_pending ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Requests to fulfil</dt><dd>{ap.requests_to_fulfil ?? 0}</dd></div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}
