import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { reApi } from '@/api/realestate'
import { EmptyState, humanize, statusVariant } from '../shared'
import { Kpi, Loading, money } from './parts'

type Recon = {
  gst: { invoiced: number; received: number; filed_gstr3b: number; difference: number }
  tds: { by_status: Record<string, number>; entries: number; overdue_deposits: number }
  issues: { severity: string; title: string; detail: string }[]
}

export default function TaxReconciliation() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const q = useQuery({
    queryKey: ['re-tax-recon', from, to],
    queryFn: () => reApi.report<Recon>('/tax/reconciliation', { date_from: from, date_to: to }),
  })
  const d = q.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {q.isLoading || !d ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="GST invoiced" value={money(d.gst.invoiced)} />
            <Kpi label="GSTR-3B filed" value={money(d.gst.filed_gstr3b)} />
            <Kpi label="Difference" value={money(d.gst.difference)} tone={Math.abs(d.gst.difference) > 1 ? 'warn' : 'good'} />
            <Kpi label="TDS deposits overdue" value={d.tds.overdue_deposits} tone={d.tds.overdue_deposits ? 'bad' : 'good'} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(d.tds.by_status).map(([s, v]) => (
              <Badge key={s} variant="secondary">TDS {humanize(s)} · {money(v)}</Badge>
            ))}
          </div>
          {d.issues.length === 0 ? (
            <EmptyState title="Books reconcile" hint="No GST, TDS, RERA or ledger-posting exceptions found." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {d.issues.map((i, k) => (
                <li key={k} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">{i.detail}</p>
                  </div>
                  <Badge variant={statusVariant(i.severity)}>{humanize(i.severity)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
