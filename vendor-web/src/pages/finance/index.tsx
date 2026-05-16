import { useFinanceDashboard, useSeedCOA } from '@/hooks/useFinance'
import { TrendingUp, TrendingDown, Landmark, ArrowLeftRight, Banknote, Coins } from 'lucide-react'

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export default function FinanceDashboard() {
  const { data, isLoading } = useFinanceDashboard()
  const seedMutation = useSeedCOA()

  if (isLoading) return <div className="p-8 text-gray-500">Loading finance dashboard…</div>

  const noData = !data || (!data.total_revenue && !data.cash_position)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.period || 'Current Fiscal Year'}</p>
        </div>
        {noData && (
          <button
            onClick={() => seedMutation.mutate(undefined)}
            disabled={seedMutation.isPending}
            className="btn-brand disabled:opacity-50"
          >
            {seedMutation.isPending ? 'Setting up…' : 'Set Up Finance (Seed COA)'}
          </button>
        )}
      </div>

      {noData && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Landmark className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold text-amber-800">Finance module not set up yet</h3>
          <p className="text-sm text-amber-600 mt-1">Click "Set Up Finance" to seed the Chart of Accounts and create your first fiscal year.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Revenue MTD" value={fmt(data?.total_revenue || 0)} icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="Expenses MTD" value={fmt(data?.total_expenses || 0)} icon={TrendingDown} color="bg-red-500" />
        <KpiCard label="Net Profit" value={fmt(data?.net_profit || 0)} icon={TrendingUp} color="bg-primary" />
        <KpiCard label="Cash Position" value={fmt(data?.cash_position || 0)} icon={Coins} color="bg-blue-500" />
        <KpiCard label="AR Outstanding" value={fmt(data?.total_ar_outstanding || 0)} icon={ArrowLeftRight} color="bg-orange-500" />
        <KpiCard label="AP Outstanding" value={fmt(data?.total_ap_outstanding || 0)} icon={Banknote} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Chart of Accounts', '/finance/coa'],
              ['Journal Entries', '/finance/journal'],
              ['Posting periods', '/finance/periods'],
              ['GL field rules', '/finance/field-rules'],
              ['Trial Balance', '/finance/trial-balance'],
              ['P&L Report', '/finance/reports/pnl'],
              ['AR Aging', '/finance/ar'],
              ['AP Bills', '/finance/ap'],
            ].map(([label, href]) => (
              <a key={href} href={href}
                className="text-sm text-primary hover:text-primary/80 hover:underline py-1">
                → {label}
              </a>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">P&L Snapshot</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Revenue</span>
              <span className="font-medium text-green-600">{fmt(data?.total_revenue || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Expenses</span>
              <span className="font-medium text-red-600">{fmt(data?.total_expenses || 0)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Net Profit / (Loss)</span>
              <span className={(data?.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                {fmt(data?.net_profit || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
