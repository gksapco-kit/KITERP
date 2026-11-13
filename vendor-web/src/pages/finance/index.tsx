import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Landmark, ArrowLeftRight, Banknote, Coins,
  Building2, BookMarked, ScrollText, Scale, FileText, Hash, Lock,
  ListChecks, HardDrive, FileBarChart, ArrowRight, Loader2, AlertTriangle,
  CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFinanceDashboard, useSeedCOA } from '@/hooks/useFinance'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LucideIcon = React.ComponentType<{ className?: string }>

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function prettyPeriod(period?: string) {
  if (!period) return 'Current fiscal year'
  const parts = period.split(/\s+to\s+/i)
  if (parts.length !== 2) return period
  const fmtDate = (s: string) => {
    const d = new Date(s.trim())
    if (Number.isNaN(d.getTime())) return s.trim()
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return `${fmtDate(parts[0])} – ${fmtDate(parts[1])}`
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  to,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: 'emerald' | 'rose' | 'primary' | 'sky' | 'amber' | 'violet'
  hint?: string
  to?: string
}) {
  const tones: Record<string, { icon: string; ring: string }> = {
    emerald: { icon: 'bg-emerald-500/10 text-emerald-600', ring: 'hover:border-emerald-300/80' },
    rose: { icon: 'bg-rose-500/10 text-rose-600', ring: 'hover:border-rose-300/80' },
    primary: { icon: 'bg-primary/10 text-primary', ring: 'hover:border-primary/40' },
    sky: { icon: 'bg-sky-500/10 text-sky-600', ring: 'hover:border-sky-300/80' },
    amber: { icon: 'bg-amber-500/10 text-amber-600', ring: 'hover:border-amber-300/80' },
    violet: { icon: 'bg-violet-500/10 text-violet-600', ring: 'hover:border-violet-300/80' },
  }
  const t = tones[tone]
  const body = (
    <Card
      className={cn(
        'h-full transition-colors',
        to && `cursor-pointer ${t.ring}`,
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', t.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {to ? <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" /> : null}
      </CardContent>
    </Card>
  )
  return to ? <Link to={to} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">{body}</Link> : body
}

const QUICK_LINK_GROUPS: { title: string; links: { label: string; to: string; icon: LucideIcon }[] }[] = [
  {
    title: 'General accounting',
    links: [
      { label: 'Chart of Accounts', to: '/finance/coa', icon: BookMarked },
      { label: 'Journal Entries', to: '/finance/journal', icon: ScrollText },
      { label: 'Document Types', to: '/finance/document-types', icon: FileText },
      { label: 'Number Ranges', to: '/finance/number-ranges', icon: Hash },
      { label: 'Posting Periods', to: '/finance/periods', icon: Lock },
      { label: 'Posting Rules', to: '/finance/posting-rules', icon: ListChecks },
    ],
  },
  {
    title: 'Working capital',
    links: [
      { label: 'Accounts Receivable', to: '/finance/ar', icon: ArrowLeftRight },
      { label: 'Accounts Payable', to: '/finance/ap', icon: Banknote },
      { label: 'Bank & Cash', to: '/finance/bank', icon: Coins },
      { label: 'Payment Terms', to: '/finance/payment-terms', icon: CalendarClock },
    ],
  },
  {
    title: 'Assets & reports',
    links: [
      { label: 'Fixed Assets', to: '/finance/assets', icon: HardDrive },
      { label: 'Asset Register', to: '/finance/assets/reports', icon: FileBarChart },
      { label: 'Trial Balance', to: '/finance/trial-balance', icon: Scale },
      { label: 'P&L Statement', to: '/finance/reports/pnl', icon: TrendingUp },
      { label: 'Balance Sheet', to: '/finance/reports/balance-sheet', icon: FileBarChart },
    ],
  },
]

function SetupBanner({
  onSetup,
  pending,
}: {
  onSetup: () => void
  pending: boolean
}) {
  return (
    <Card className="border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/20">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">Finish finance setup</p>
            <p className="mt-0.5 text-sm text-amber-800/80 dark:text-amber-200/80">
              Seed a starter Chart of Accounts and create your first fiscal year so journals and reports can post.
            </p>
          </div>
        </div>
        <Button onClick={onSetup} disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
          {pending ? 'Setting up…' : 'Set up finance'}
        </Button>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    </div>
  )
}

function PlSnapshot({
  revenue,
  expenses,
  net,
}: {
  revenue: number
  expenses: number
  net: number
}) {
  const total = Math.abs(revenue) + Math.abs(expenses)
  const revPct = total > 0 ? (Math.abs(revenue) / total) * 100 : 0
  const expPct = total > 0 ? (Math.abs(expenses) / total) * 100 : 0
  const profitable = net >= 0

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">P&L snapshot</CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link to="/finance/reports/pnl">
              Full report <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total revenue</span>
            <span className="font-medium tabular-nums text-emerald-600">{fmt(revenue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total expenses</span>
            <span className="font-medium tabular-nums text-rose-600">{fmt(expenses)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2.5 text-sm font-semibold">
            <span>Net profit / (loss)</span>
            <span className={cn('tabular-nums', profitable ? 'text-emerald-600' : 'text-rose-600')}>
              {fmt(net)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Mix (period)
          </p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${revPct}%` }}
              title={`Revenue ${revPct.toFixed(0)}%`}
            />
            <div
              className="bg-rose-400 transition-all"
              style={{ width: `${expPct}%` }}
              title={`Expenses ${expPct.toFixed(0)}%`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Revenue {revPct.toFixed(0)}%</span>
            <span>Expenses {expPct.toFixed(0)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FinanceDashboard() {
  const { data, isLoading, isError, refetch } = useFinanceDashboard()
  const seedMutation = useSeedCOA()

  if (isLoading) return <DashboardSkeleton />

  const revenue = Number(data?.total_revenue || 0)
  const expenses = Number(data?.total_expenses || 0)
  const net = Number(data?.net_profit || 0)
  const cash = Number(data?.cash_position || 0)
  const ar = Number(data?.total_ar_outstanding || 0)
  const ap = Number(data?.total_ap_outstanding || 0)
  const assetCount = Number(data?.fixed_asset_count ?? 0)

  const hasActivity =
    Math.abs(revenue) > 0 ||
    Math.abs(expenses) > 0 ||
    Math.abs(cash) > 0 ||
    Math.abs(ar) > 0 ||
    Math.abs(ap) > 0 ||
    assetCount > 0

  const needsSetup = !isError && !hasActivity

  const handleSeed = () => {
    seedMutation.mutate(undefined, {
      onSuccess: () => toast.success('Finance setup complete — Chart of Accounts seeded.'),
      onError: (e: any) => {
        const d = e?.response?.data?.detail
        toast.error(typeof d === 'string' ? d : 'Could not set up finance. Try again.')
      },
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Finance Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-11">
            <Badge variant="secondary" className="font-normal">
              {prettyPeriod(data?.period)}
            </Badge>
            <span className="text-xs text-muted-foreground">FY-to-date snapshot</span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/finance/journal">
            <ScrollText className="h-4 w-4" />
            New journal
          </Link>
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-rose-800">Could not load finance metrics.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {needsSetup && (
        <SetupBanner onSetup={handleSeed} pending={seedMutation.isPending} />
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Revenue" value={fmt(revenue)} icon={TrendingUp} tone="emerald" hint="FY to date" />
          <KpiCard label="Expenses" value={fmt(expenses)} icon={TrendingDown} tone="rose" hint="FY to date" />
          <KpiCard
            label="Net profit"
            value={fmt(net)}
            icon={net >= 0 ? TrendingUp : TrendingDown}
            tone={net >= 0 ? 'primary' : 'rose'}
            hint={net >= 0 ? 'In the black' : 'Loss for period'}
          />
          <KpiCard label="Cash position" value={fmt(cash)} icon={Coins} tone="sky" to="/finance/bank" />
          <KpiCard label="AR outstanding" value={fmt(ar)} icon={ArrowLeftRight} tone="amber" to="/finance/ar" />
          <KpiCard label="AP outstanding" value={fmt(ap)} icon={Banknote} tone="violet" to="/finance/ap" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fixed assets
          </h2>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link to="/finance/assets">
              Manage assets <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Active assets"
            value={String(assetCount)}
            icon={Building2}
            tone="violet"
            to="/finance/assets"
          />
          <KpiCard
            label="Net book value"
            value={fmt(Number(data?.fixed_asset_nbv || 0))}
            icon={Coins}
            tone="sky"
            to="/finance/assets/reports"
          />
          <KpiCard
            label="Accum. depreciation"
            value={fmt(Number(data?.fixed_asset_accum_dep || 0))}
            icon={TrendingDown}
            tone="rose"
          />
          <KpiCard
            label="Depreciation YTD"
            value={fmt(Number(data?.fixed_asset_depreciation_ytd || 0))}
            icon={TrendingDown}
            tone="amber"
            to="/finance/assets/depreciation-schedule"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            {QUICK_LINK_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.links.map((link) => {
                    const Icon = link.icon
                    return (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          className="group flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-foreground hover:bg-muted/70"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                          <span className="truncate group-hover:text-primary">{link.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <PlSnapshot revenue={revenue} expenses={expenses} net={net} />
        </div>
      </div>
    </div>
  )
}
