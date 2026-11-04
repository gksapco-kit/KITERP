import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { reApi } from '@/api/realestate'
import { Kpi, Loading, SimpleTable, money } from './parts'

type Row = {
  project_id: string; project: string; rera_number: string | null; collected: number; required_reserve: number
  deposited: number; shortfall: number; withdrawn: number; pending_withdrawals: number; balance_in_account: number
  last_certified_percent: number; compliant: boolean
}

export default function ReraAccount() {
  const q = useQuery({
    queryKey: ['re-rera'],
    queryFn: () => reApi.report<{ reserve_percent: number; projects: Row[]; non_compliant: number }>('/tax/rera-account'),
  })
  if (q.isLoading || !q.data) return <Loading />
  const d = q.data
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Required reserve" value={`${d.reserve_percent}% of collections`} />
        <Kpi label="Projects short of reserve" value={d.non_compliant} tone={d.non_compliant ? 'bad' : 'good'} />
        <Kpi label="Total in RERA accounts" value={money(d.projects.reduce((s, p) => s + p.balance_in_account, 0))} />
        <Kpi label="Withdrawals awaiting approval" value={money(d.projects.reduce((s, p) => s + p.pending_withdrawals, 0))} tone="warn" />
      </div>
      <SimpleTable<Row>
        rows={d.projects}
        empty="No projects"
        cols={[
          { key: 'project', label: 'Project', render: (r) => (<div><p className="font-medium">{r.project}</p><p className="text-xs text-muted-foreground">{r.rera_number ?? 'No RERA no.'}</p></div>) },
          { key: 'collected', label: 'Collected', right: true, render: (r) => money(r.collected) },
          { key: 'required_reserve', label: `Required ${d.reserve_percent}%`, right: true, render: (r) => money(r.required_reserve) },
          { key: 'deposited', label: 'Deposited', right: true, render: (r) => money(r.deposited) },
          { key: 'withdrawn', label: 'Withdrawn', right: true, render: (r) => money(r.withdrawn) },
          { key: 'balance_in_account', label: 'Balance', right: true, render: (r) => money(r.balance_in_account) },
          { key: 'last_certified_percent', label: 'Certified %', right: true, render: (r) => `${r.last_certified_percent}%` },
          {
            key: 'compliant', label: 'Status', render: (r) =>
              r.compliant ? <Badge variant="success">Compliant</Badge> : <Badge variant="destructive">Short {money(r.shortfall)}</Badge>,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Record deposits and withdrawal requests under “RERA Account”. A withdrawal is limited to the certified completion % of the
        deposited reserve, less earlier withdrawals, and needs a certifier’s reference.
      </p>
    </div>
  )
}
