import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { reApi } from '@/api/realestate'
import { Kpi, Loading, money } from './parts'

const LINKS = [
  { to: '/finance/ar', title: 'Accounts receivable', hint: 'Customer ledgers and open items (demands post here).' },
  { to: '/finance/ap', title: 'Accounts payable', hint: 'Vendor bills — contractor and supplier payables.' },
  { to: '/finance/bank', title: 'Bank & cash', hint: 'Reconcile cleared cheques and RTGS receipts.' },
  { to: '/finance/journal', title: 'Journal entries', hint: 'Demand, receipt and commission postings.' },
  { to: '/finance/tax', title: 'Tax', hint: 'GST codes, returns and TDS in the core ledger.' },
  { to: '/finance/trial-balance', title: 'Trial balance', hint: 'Check the books balance after postings.' },
]

export default function FinanceHub() {
  const summary = useQuery({ queryKey: ['re-collections-summary', ''], queryFn: () => reApi.report('/collections/summary') })
  const recon = useQuery({ queryKey: ['re-tax-recon'], queryFn: () => reApi.report('/tax/reconciliation') })
  if (summary.isLoading) return <Loading />
  const s = summary.data
  const issues: { severity: string; title: string; detail: string }[] = recon.data?.issues ?? []
  return (
    <div className="space-y-5">
      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Collected to date" value={money(s.collected)} tone="good" />
          <Kpi label="Demanded, outstanding" value={money(s.demanded_outstanding)} tone="warn" />
          <Kpi label="Overdue" value={money(s.overdue)} tone={s.overdue ? 'bad' : 'good'} />
          <Kpi label="Collected %" value={`${s.collected_percent}%`} />
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
          <h3 className="mb-2 text-sm font-semibold">Needs attention</h3>
          <ul className="space-y-1 text-sm">
            {issues.slice(0, 5).map((i, k) => (<li key={k}><strong>{i.title}</strong> — {i.detail}</li>))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{l.title}</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{l.hint}</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Demands, receipts and broker payouts are posted to the general ledger automatically when the Finance module is configured.
      </p>
    </div>
  )
}
