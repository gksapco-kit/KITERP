import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { reApi } from '@/api/realestate'
import { Kpi, Loading, ProjectFilter, SimpleTable, money } from './parts'

type Gst = {
  invoiced: { taxable_value: number; gst: number; cgst: number; sgst: number }
  received: { gross: number; gst: number }
  gst_receivable_on_unbilled_receipts: number
  by_month: { month: string; invoiced_taxable?: number; invoiced_gst?: number; received_gross?: number; received_gst?: number }[]
  by_project: { project: string; invoiced_taxable?: number; invoiced_gst?: number; received_gross?: number; received_gst?: number }[]
  note: string
}

export default function GstSummary() {
  const [projectId, setProjectId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const q = useQuery({
    queryKey: ['re-gst', projectId, from, to],
    queryFn: () => reApi.report<Gst>('/tax/gst-summary', { project_id: projectId, date_from: from, date_to: to }),
  })
  const d = q.data
  const cols = (first: string, key: 'month' | 'project') => [
    { key, label: first },
    { key: 'invoiced_taxable', label: 'Invoiced (taxable)', right: true, render: (r: any) => money(r.invoiced_taxable) },
    { key: 'invoiced_gst', label: 'GST on invoices', right: true, render: (r: any) => money(r.invoiced_gst) },
    { key: 'received_gross', label: 'Received', right: true, render: (r: any) => money(r.received_gross) },
    { key: 'received_gst', label: 'GST in receipts', right: true, render: (r: any) => money(r.received_gst) },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ProjectFilter value={projectId} onChange={setProjectId} />
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {q.isLoading || !d ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Taxable value invoiced" value={money(d.invoiced.taxable_value)} />
            <Kpi label="GST invoiced" value={money(d.invoiced.gst)} />
            <Kpi label="CGST / SGST" value={`${money(d.invoiced.cgst)} / ${money(d.invoiced.sgst)}`} />
            <Kpi label="Received (gross)" value={money(d.received.gross)} tone="good" />
            <Kpi label="GST on unbilled receipts" value={money(d.gst_receivable_on_unbilled_receipts)} tone={d.gst_receivable_on_unbilled_receipts ? 'warn' : undefined} />
          </div>
          <SimpleTable rows={d.by_month} cols={cols('Month', 'month')} empty="No GST activity in this period" />
          <SimpleTable rows={d.by_project} cols={cols('Project', 'project')} empty="" />
          <p className="text-xs text-muted-foreground">{d.note}</p>
        </>
      )}
    </div>
  )
}
