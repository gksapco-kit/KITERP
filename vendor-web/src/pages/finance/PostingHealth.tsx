import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import * as api from '@/api/finance'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/common/ConfirmProvider'

type Tab = 'failures' | 'unposted' | 'readiness' | 'golive'

const KEY = ['finance', 'posting-health'] as const

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0)

const SOURCE_LABEL: Record<string, string> = {
  vendor_bill: 'Vendor bill',
  vendor_payment: 'Vendor payment',
  invoice: 'Sales invoice',
  credit_note: 'Credit note',
  payment: 'Customer receipt',
  payroll: 'Payroll',
  pos: 'POS session',
  expense: 'Expense',
  asset: 'Fixed asset',
  manual: 'Manual / recurring journal',
}

const label = (s: string) => SOURCE_LABEL[s] ?? s.replace(/_/g, ' ')

function errMsg(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof d === 'string' ? d : fallback
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function FailuresTab() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({
    queryKey: [...KEY, 'failures'],
    queryFn: () => api.listPostingFailures('open'),
  })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: KEY })
    void qc.invalidateQueries({ queryKey: ['finance', 'posting-health-count'] })
  }
  const retryOne = useMutation({
    mutationFn: api.retryPostingFailure,
    onSuccess: r => {
      if (r.status === 'resolved') toast.success('Posted to the ledger')
      else toast.error(r.error || 'Still failing — fix the cause and retry', { duration: 10_000 })
      refresh()
    },
    onError: e => toast.error(errMsg(e, 'Retry failed')),
  })
  const retryAll = useMutation({
    mutationFn: api.retryAllPostingFailures,
    onSuccess: r => {
      toast.success(`${r.resolved} posted, ${r.still_open} still failing`)
      refresh()
    },
    onError: e => toast.error(errMsg(e, 'Retry failed')),
  })
  const ignoreOne = useMutation({
    mutationFn: api.ignorePostingFailure,
    onSuccess: () => { toast.success('Marked as intentionally not posted'); refresh() },
    onError: e => toast.error(errMsg(e, 'Could not ignore')),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (data.length === 0) {
    return (
      <Empty>
        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
        No open posting failures. Every document that reached the ledger layer was posted.
      </Empty>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          These documents were saved but could <strong>not</strong> be posted to the general ledger. They are
          not in your reports until fixed.
        </p>
        <button
          type="button"
          disabled={retryAll.isPending}
          onClick={() => retryAll.mutate()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {retryAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Retry all
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {['Type', 'Reference', 'Amount', 'Why it failed', 'Tries', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map(f => (
              <tr key={f.id} className="align-top">
                <td className="px-4 py-2.5 font-medium">{label(f.source_type)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{f.reference || f.source_id.slice(0, 8)}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums">{inr(f.amount)}</td>
                <td className="px-4 py-2.5 text-red-700 dark:text-red-300 max-w-md break-words">{f.error}</td>
                <td className="px-4 py-2.5 tabular-nums">{f.attempts}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={retryOne.isPending}
                      onClick={() => retryOne.mutate(f.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                    <button
                      type="button"
                      disabled={ignoreOne.isPending}
                      onClick={async () => {
                        if (await askConfirm({
                          title: 'Ignore this posting failure?',
                          description: 'The document will stay out of the ledger. The decision is kept for audit.',
                          variant: 'warning',
                          confirmLabel: 'Ignore',
                        })) ignoreOne.mutate(f.id)
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Ignore
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UnpostedTab() {
  const qc = useQueryClient()
  const [from, setFrom] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: [...KEY, 'unposted', from],
    queryFn: () => api.listUnposted(from ? { from_date: from } : undefined),
  })
  const repost = useMutation({
    mutationFn: (v: { t: 'invoice' | 'vendor_bill' | 'vendor_payment'; id: string }) => api.repostDocument(v.t, v.id),
    onSuccess: r => {
      if (r.posted) toast.success('Posted to the ledger')
      else toast.error(r.error || 'Posting failed', { duration: 10_000 })
      void qc.invalidateQueries({ queryKey: KEY })
    },
    onError: e => toast.error(errMsg(e, 'Re-post failed')),
  })

  const groups: { key: 'invoice' | 'vendor_bill' | 'vendor_payment'; title: string }[] = [
    { key: 'invoice', title: 'Sales invoices & credit notes' },
    { key: 'vendor_bill', title: 'Vendor bills' },
    { key: 'vendor_payment', title: 'Vendor payments' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Documents dated on/after{' '}
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="ml-1 h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        {data && <span className="text-sm text-muted-foreground">{data.total} document(s) without a ledger entry</span>}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && data.total === 0 && (
        <Empty>
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
          Every invoice, bill and payment has a ledger entry.
        </Empty>
      )}
      {data && groups.map(g => data[g.key].length > 0 && (
        <div key={g.key} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold">
            {g.title} <span className="font-normal text-muted-foreground">({data[g.key].length})</span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {data[g.key].map(d => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 font-medium">{d.number}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.date}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{inr(d.amount)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.status}</td>
                  <td className="px-4 py-2.5 text-amber-800 dark:text-amber-300 max-w-sm break-words">{d.reason}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={repost.isPending}
                      onClick={() => repost.mutate({ t: g.key, id: d.id })}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Post now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function ReadinessTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: [...KEY, 'readiness'], queryFn: api.getPostingReadiness })
  const fix = useMutation({
    mutationFn: api.ensureDefaultAccounts,
    onSuccess: r => {
      toast.success(r.count ? `Added ${r.count} missing account(s): ${r.added_codes.join(', ')}` : 'No missing default accounts')
      void qc.invalidateQueries({ queryKey: KEY })
    },
    onError: e => toast.error(errMsg(e, 'Could not add accounts')),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Running dry-run…</p>
  if (!data) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Dry-runs every posting rule against your chart of accounts. Nothing is written.
        </p>
        {!data.ready && (
          <button
            type="button"
            disabled={fix.isPending}
            onClick={() => fix.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {fix.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add missing default accounts
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <ul className="divide-y divide-border">
          {data.items.map(i => (
            <li key={i.source_type} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              {i.ready
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
              <span className="w-48 shrink-0 font-medium">{label(i.source_type)}</span>
              <span className={cn('min-w-0 break-words', i.ready ? 'text-muted-foreground' : 'text-red-700 dark:text-red-300')}>
                {i.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function GoLiveTab() {
  const { data, isLoading } = useQuery({ queryKey: [...KEY, 'golive'], queryFn: api.getGoLiveCheck })
  if (isLoading) return <p className="text-sm text-muted-foreground">Running checks…</p>
  if (!data) return null
  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium',
          data.ready_for_go_live
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        )}
      >
        {data.ready_for_go_live ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        {data.ready_for_go_live
          ? 'All pre-go-live checks passed.'
          : `${data.checks.length - data.passed} of ${data.checks.length} checks need attention before go-live.`}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <ul className="divide-y divide-border">
          {data.checks.map(c => (
            <li key={c.check} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              {c.status === 'pass'
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
              <div className="min-w-0">
                <p className="font-medium">{c.check}</p>
                <p className="text-muted-foreground">{c.detail}</p>
                {c.status === 'fail' && c.remedy && <p className="mt-0.5 text-amber-800 dark:text-amber-300">{c.remedy}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function PostingHealth() {
  const [tab, setTab] = useState<Tab>('failures')
  const { data: failures = [] } = useQuery({
    queryKey: ['finance', 'posting-health-count'],
    queryFn: () => api.listPostingFailures('open'),
    refetchInterval: 60_000,
  })

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'failures', label: 'Posting failures', badge: failures.length },
    { id: 'unposted', label: 'Unposted documents' },
    { id: 'readiness', label: 'Posting readiness' },
    { id: 'golive', label: 'Go-live checklist' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Posting health
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Your books are only complete when every document is in the ledger. Fix anything listed here before you
          close a period or file a return.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm',
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/40',
            )}
          >
            {t.label}
            {!!t.badge && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'failures' && <FailuresTab />}
      {tab === 'unposted' && <UnpostedTab />}
      {tab === 'readiness' && <ReadinessTab />}
      {tab === 'golive' && <GoLiveTab />}
    </div>
  )
}
