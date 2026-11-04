import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as api from '@/api/finance'

const inr = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0)

function fyStart(): string {
  const d = new Date()
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-04-01`
}

const SECTION_NAME: Record<string, string> = {
  '192': 'Salaries',
  '194A': 'Interest (other than securities)',
  '194C': 'Contractors',
  '194H': 'Commission / brokerage',
  '194I': 'Rent',
  '194J': 'Professional / technical fees',
  '194Q': 'Purchase of goods',
}

export default function TdsSectionReport() {
  const [from, setFrom] = useState(fyStart())
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const { data, isLoading, isError } = useQuery({
    queryKey: ['finance', 'tds-report', from, to],
    queryFn: () => api.getTdsReport({ from_date: from, to_date: to }),
    enabled: !!from && !!to && from <= to,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          To
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="ml-2 h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
        </label>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Could not load the TDS report.</p>}
      {data?.note && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{data.note}</p>}

      {data && !data.note && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { l: 'TDS deducted', v: data.total_tds_deducted },
              { l: 'Deposited to government', v: data.total_tds_deposited },
              { l: 'Still to deposit', v: data.outstanding_to_deposit },
            ].map(c => (
              <div key={c.l} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{c.l}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{inr(c.v)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {['Section', 'Nature', 'Bills', 'Paid / credited', 'TDS deducted'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.by_section.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No TDS deducted in this period.</td></tr>
                )}
                {data.by_section.map(s => (
                  <tr key={s.section}>
                    <td className="px-4 py-2.5 font-semibold">{s.section}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{SECTION_NAME[s.section] ?? ''}</td>
                    <td className="px-4 py-2.5 tabular-nums">{s.bills ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{s.amount_paid_or_credited == null ? '—' : inr(s.amount_paid_or_credited)}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{inr(s.tds_deducted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Math.abs(data.unclassified) > 0.01 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {inr(data.unclassified)} of TDS Payable activity is not tied to a section (for example a manual journal).
              Form 26Q needs the section for every deduction — reclassify before filing.
            </p>
          )}
        </>
      )}
    </div>
  )
}
