import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { Badge } from '@/components/ui/badge'
import { humanize } from '../shared'
import { Kpi, Loading, SimpleTable, money } from './parts'

type Item = { kind: string; id: string; ref: string; party: string; amount: number; due_date: string; days_overdue: number }

type Summary = {
  total_payable: number
  by_kind: Record<string, number>
  ageing: Record<string, number>
  retention_held: number
  items: Item[]
}

const BUCKETS: [string, string][] = [
  ['not_due', 'Not due'],
  ['d1_30', '1–30 days'],
  ['d31_60', '31–60 days'],
  ['d61_90', '61–90 days'],
  ['d90_plus', '90+ days'],
]

export default function Payables() {
  const q = useQuery({ queryKey: ['re-payables'], queryFn: () => reApi.report<Summary>('/payables/summary') })
  if (q.isLoading || !q.data) return <Loading />
  const d = q.data
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total payable" value={money(d.total_payable)} tone={d.total_payable ? 'warn' : 'good'} />
        <Kpi label="Suppliers" value={money(d.by_kind.supplier)} />
        <Kpi label="Contractors" value={money(d.by_kind.contractor)} />
        <Kpi label="Brokers" value={money(d.by_kind.broker)} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {BUCKETS.map(([k, label]) => (
          <Kpi key={k} label={label} value={money(d.ageing[k])} tone={k !== 'not_due' && d.ageing[k] ? 'bad' : undefined} />
        ))}
        <Kpi label="Retention held" value={money(d.retention_held)} />
      </div>
      <SimpleTable
        rows={d.items}
        empty="Nothing is payable right now"
        cols={[
          { key: 'kind', label: 'Type', render: (r) => <Badge variant="soft">{humanize(r.kind)}</Badge> },
          { key: 'ref', label: 'Reference' },
          { key: 'party', label: 'Payee' },
          { key: 'due_date', label: 'Due' },
          { key: 'days_overdue', label: 'Overdue', right: true, render: (r) => (r.days_overdue > 0 ? <span className="text-red-600">{r.days_overdue}d</span> : '—') },
          { key: 'amount', label: 'Amount', right: true, render: (r) => money(r.amount) },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Supplier amounts are posted GRNs awaiting payment; contractor amounts are approved RA bills (net of retention, TDS and advance recovery);
        broker amounts are approved settlements. Retention is a liability but is not due until the contract is completed.
      </p>
    </div>
  )
}
