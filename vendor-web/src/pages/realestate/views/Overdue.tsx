import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Wallet, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errMessage, reApi } from '@/api/realestate'
import type { ActionMeta } from '@/api/realestate'
import { ActionDialog } from '../ResourceTable'
import { useREMeta } from '../shared'
import { Kpi, Loading, ProjectFilter, SimpleTable, money } from './parts'

type OverdueItem = {
  demand_id: string; demand_no: string; booking_id: string; booking_no: string; customer: string; phone: string | null
  unit: string; stage: string; due_date: string; outstanding: number; days_overdue: number; interest: number; bucket: string
}
type OverdueReport = {
  count: number; total_overdue: number; total_interest: number
  buckets: Record<string, { count: number; amount: number }>
  top_customers: { customer: string; outstanding: number }[]
  items: OverdueItem[]
}

const BUCKET_TONE: Record<string, 'default' | 'secondary' | 'destructive'> = { '0-30': 'secondary', '31-60': 'secondary', '61-90': 'destructive', '90+': 'destructive' }

export default function Overdue() {
  const { data: meta } = useREMeta()
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const [pay, setPay] = useState<{ id: string; label: string } | null>(null)

  const report = useQuery({
    queryKey: ['re-overdue', projectId],
    queryFn: () => reApi.report<OverdueReport>('/collections/overdue', { project_id: projectId }),
  })
  const gen = useMutation({
    mutationFn: () => reApi.post('/collections/generate-demands', { project_id: projectId || undefined }),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: ['re-overdue'] })
      qc.invalidateQueries({ queryKey: ['re-list'] })
    },
    onError: (e) => toast.error(errMessage(e)),
  })

  const perms = meta?.permissions ?? []
  const canCollect = perms.some((p) => ['realestate.collections', 'realestate.admin'].includes(p))
  const bookings = meta?.resources.bookings
  const receive: ActionMeta | undefined = bookings?.actions.find((a) => a.key === 'receive')

  if (report.isLoading) return <Loading />
  const d = report.data
  if (!d) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ProjectFilter value={projectId} onChange={setProjectId} />
        {canCollect && (
          <Button size="sm" variant="outline" onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Raise due demands
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Overdue demands" value={d.count} tone={d.count ? 'bad' : 'good'} />
        <Kpi label="Overdue amount" value={money(d.total_overdue)} tone={d.total_overdue ? 'bad' : 'good'} />
        <Kpi label="Delay interest (informational)" value={money(d.total_interest)} tone={d.total_interest ? 'warn' : undefined} />
        <Kpi label="90+ days" value={money(d.buckets['90+']?.amount ?? 0)} tone={d.buckets['90+']?.amount ? 'bad' : undefined} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {['0-30', '31-60', '61-90', '90+'].map((b) => (
          <Badge key={b} variant={BUCKET_TONE[b]}>{b} days · {d.buckets[b]?.count ?? 0} · {money(d.buckets[b]?.amount ?? 0)}</Badge>
        ))}
      </div>

      <SimpleTable<OverdueItem>
        empty="No overdue demands 🎉"
        rows={d.items}
        cols={[
          { key: 'customer', label: 'Customer', render: (r) => (<div><p className="font-medium">{r.customer}</p><p className="text-xs text-muted-foreground">{r.phone ?? ''}</p></div>) },
          { key: 'booking_no', label: 'Booking' },
          { key: 'unit', label: 'Unit' },
          { key: 'stage', label: 'Stage' },
          { key: 'due_date', label: 'Due' },
          { key: 'days_overdue', label: 'Days', right: true, render: (r) => <Badge variant={BUCKET_TONE[r.bucket]}>{r.days_overdue}</Badge> },
          { key: 'outstanding', label: 'Outstanding', right: true, render: (r) => money(r.outstanding) },
          { key: 'interest', label: 'Interest', right: true, render: (r) => money(r.interest) },
          {
            key: 'act', label: '', render: (r) =>
              canCollect && receive ? (
                <Button size="xs" variant="outline" onClick={() => setPay({ id: r.booking_id, label: r.booking_no })}>
                  <Wallet className="h-3 w-3" /> Receive
                </Button>
              ) : null,
          },
        ]}
      />

      {d.top_customers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Largest outstanding</h3>
          <ul className="space-y-1 text-sm">
            {d.top_customers.map((c) => (
              <li key={c.customer} className="flex justify-between"><span>{c.customer}</span><span className="tabular-nums">{money(c.outstanding)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {pay && bookings && receive && (
        <ActionDialog
          res={bookings}
          row={{ id: pay.id, _label: pay.label }}
          action={receive}
          onClose={() => setPay(null)}
          onDone={(out) => {
            setPay(null)
            toast.success(out?.message || 'Payment recorded')
            for (const w of out?.warnings ?? []) toast.warning(w)
            qc.invalidateQueries({ queryKey: ['re-overdue'] })
          }}
        />
      )}
    </div>
  )
}
