import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMyPlan, useAvailablePlans, usePayForPlan, usePlanPayments } from '@/hooks/useVendor'
import { filterPublicSaasPlans } from '@/lib/saasPlans'
import { Button } from '@/components/ui/button'
import {
  CreditCard, Check, X, ArrowUp, ArrowDown, Loader2,
  Zap, AlertCircle, LayoutGrid, RefreshCw, Package, Users, HardDrive,
  Sparkles, Shield,
} from 'lucide-react'
import type { VendorPlanInfo } from '@/types'
import { cn } from '@/lib/utils'

const FEATURE_LABELS: Record<string, string> = {
  branded_app: 'Branded App',
  custom_domain: 'Custom Domain',
  analytics: 'Analytics',
  api_access: 'API Access',
  priority_support: 'Priority Support',
  white_label: 'White Label',
  restaurant: 'Restaurant',
  pos: 'POS',
}

type BillingCycle = 'monthly' | 'yearly'

const PLAN_STYLE: Record<
  string,
  {
    accent: string
    ring: string
    badge: string
    glow: string
    iconBg: string
  }
> = {
  starter: {
    accent: 'from-blue-500/20 via-blue-400/5 to-transparent',
    ring: 'ring-blue-400/30',
    badge: 'bg-blue-600',
    glow: 'shadow-blue-500/10',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  growth: {
    accent: 'from-emerald-500/25 via-teal-400/10 to-transparent',
    ring: 'ring-emerald-400/40',
    badge: 'bg-emerald-600',
    glow: 'shadow-emerald-500/20',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  },
  professional: {
    accent: 'from-violet-500/20 via-indigo-400/5 to-transparent',
    ring: 'ring-violet-400/25',
    badge: 'bg-violet-600',
    glow: 'shadow-violet-500/10',
    iconBg: 'bg-gradient-to-br from-violet-600 to-indigo-600',
  },
}

function planStyle(slug: string) {
  return PLAN_STYLE[slug] ?? PLAN_STYLE.starter
}

function appsLimitLabel(maxApps: number | undefined | null) {
  if (maxApps == null || maxApps < 0) return 'All apps'
  if (maxApps === 0) return 'No new apps'
  return `${maxApps} app${maxApps === 1 ? '' : 's'}`
}

function formatExpiry(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlanCard({
  plan,
  currentPlan,
  onSelect,
  isLoading,
  billingCycle,
}: {
  plan: VendorPlanInfo
  currentPlan: VendorPlanInfo | null
  onSelect: (planId: string) => void
  isLoading: boolean
  billingCycle: BillingCycle
}) {
  const isCurrent = currentPlan?.id === plan.id
  const isUpgrade = currentPlan && plan.price_monthly > currentPlan.price_monthly
  const [confirming, setConfirming] = useState(false)
  const cur = plan.currency === 'INR' ? '₹' : '$'
  const style = planStyle(plan.slug)
  const isFeatured = plan.is_featured && !isCurrent

  const monthly = plan.price_monthly
  const yearly = plan.price_yearly ?? monthly * 12
  const displayPrice = billingCycle === 'yearly' ? Math.round(yearly / 12) : monthly
  const yearlyTotal = yearly
  const yearlySavePct =
    monthly > 0 && yearly < monthly * 12
      ? Math.round((1 - yearly / (monthly * 12)) * 100)
      : 0

  const handleClick = () => {
    if (isCurrent) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onSelect(plan.id)
  }

  const featureRows = Object.entries(FEATURE_LABELS)
  const storageLabel =
    plan.max_storage_mb >= 1000
      ? `${plan.max_storage_mb / 1000} GB`
      : `${plan.max_storage_mb} MB`

  return (
    <article
      className={cn(
        'group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-white/95 backdrop-blur-sm transition-all duration-300',
        isCurrent
          ? cn('border-blue-300/80 shadow-lg ring-2', style.ring, style.glow)
          : isFeatured
            ? cn('border-emerald-300/80 shadow-lg ring-2', style.ring, style.glow)
            : 'border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md',
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b', style.accent)} />

      <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 p-3">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
                  style.iconBg,
                )}
              >
                {plan.slug === 'professional' ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : plan.slug === 'growth' ? (
                  <Zap className="h-3.5 w-3.5" />
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">
                  {plan.name}
                </h3>
                <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <LayoutGrid className="h-3 w-3 shrink-0" />
                  My Kit + {appsLimitLabel(plan.max_apps)}
                </p>
              </div>
            </div>
            {(isCurrent || isFeatured) && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm',
                  isCurrent ? 'bg-blue-600' : style.badge,
                )}
              >
                {isCurrent ? <Check className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                {isCurrent ? 'Current' : 'Popular'}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {cur}{displayPrice.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">/mo</span>
            </div>
            {billingCycle === 'yearly' && yearlySavePct > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Save {yearlySavePct}%
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
            {billingCycle === 'yearly'
              ? `Billed ${cur}${yearlyTotal.toLocaleString()} yearly`
              : plan.description}
          </p>
        </div>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Plan details
          </p>
          <ul className="grid h-full min-h-[7.5rem] grid-cols-2 grid-rows-4 content-center gap-x-3 gap-y-1">
            {featureRows.map(([key, label]) => {
              const enabled = Boolean(plan.features?.[key])
              return (
                <li
                  key={key}
                  className={cn(
                    'flex min-h-0 items-center gap-1.5 text-[11px] leading-none',
                    enabled ? 'font-medium text-slate-800' : 'text-slate-400',
                  )}
                >
                  {enabled ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="h-2.5 w-2.5 text-emerald-700" />
                    </span>
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <X className="h-2.5 w-2.5 text-slate-400" />
                    </span>
                  )}
                  <span className="truncate">{label}</span>
                </li>
              )
            })}
          </ul>
          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
            {[
              { icon: Package, value: plan.max_products === -1 ? '∞' : String(plan.max_products), label: 'Products' },
              { icon: Users, value: String(plan.max_team_members), label: 'Team' },
              { icon: HardDrive, value: storageLabel, label: 'Storage' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-center gap-1.5 px-1 py-1.5">
                <stat.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div className="min-w-0 leading-none">
                  <p className="truncate text-[11px] font-semibold text-slate-900">{stat.value}</p>
                  <p className="mt-0.5 text-[9px] text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2">
        {isCurrent ? (
          <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-semibold text-blue-700">
            <Check className="h-3.5 w-3.5" /> Active plan
          </div>
        ) : confirming ? (
          <div className="space-y-1.5 rounded-lg border border-amber-200/80 bg-amber-50/90 p-2">
            <p className="text-[10px] leading-snug text-amber-900">
              Pay{' '}
              <strong>
                {cur}
                {(billingCycle === 'yearly' ? yearlyTotal : monthly).toLocaleString()}
                {billingCycle === 'yearly' ? '/yr' : '/mo'}
              </strong>{' '}
              via Razorpay?
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 rounded-lg text-xs"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 flex-1 gap-1 rounded-lg bg-slate-900 text-xs text-white hover:bg-slate-800"
                onClick={handleClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isUpgrade ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            className={cn(
              'h-9 w-full gap-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all',
              isUpgrade || isFeatured
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700'
                : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
            )}
            variant={isUpgrade || isFeatured ? 'default' : 'outline'}
            onClick={handleClick}
            disabled={isLoading}
          >
            {isUpgrade ? (
              <>
                <ArrowUp className="h-3.5 w-3.5" /> Upgrade to {plan.name}
              </>
            ) : plan.price_monthly > 0 ? (
              <>
                <CreditCard className="h-3.5 w-3.5" /> Upgrade · {cur}
                {displayPrice.toLocaleString()}/mo
              </>
            ) : (
              <>Switch plan</>
            )}
          </Button>
        )}
      </div>
      </div>
    </article>
  )
}

export default function PlansPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: myPlanData, isLoading: planLoading } = useMyPlan()
  const { data: availablePlans, isLoading: plansLoading } = useAvailablePlans()
  const payForPlan = usePayForPlan()
  const { data: paymentHistory } = usePlanPayments()
  const [historyOpen, setHistoryOpen] = useState(false)
  const autoStartedRef = useRef(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')

  const currentPlan = myPlanData?.plan ?? null
  const displayPlans = useMemo(
    () => filterPublicSaasPlans(availablePlans),
    [availablePlans],
  )
  const isLoading = planLoading || plansLoading
  const isExpired = Boolean(myPlanData?.is_expired)
  const inGrace = Boolean(myPlanData?.in_grace)
  const expiryLabel = formatExpiry(myPlanData?.plan_expires_at)

  useEffect(() => {
    if (isLoading || autoStartedRef.current || payForPlan.isPending) return
    const auto = searchParams.get('auto') === '1'
    const checkoutSlug = (
      searchParams.get('checkout') ||
      myPlanData?.pending_plan_slug ||
      ''
    )
      .trim()
      .toLowerCase()
    if (!auto || !checkoutSlug || !displayPlans.length) return

    const target = displayPlans.find((p) => p.slug === checkoutSlug)
    if (!target) return

    if (currentPlan?.id === target.id && !isExpired && myPlanData?.billing_status === 'active') {
      autoStartedRef.current = true
      setSearchParams({}, { replace: true })
      return
    }

    autoStartedRef.current = true
    setSearchParams({}, { replace: true })
    payForPlan.mutate(target.id)
  }, [
    isLoading,
    searchParams,
    displayPlans,
    currentPlan?.id,
    isExpired,
    myPlanData?.billing_status,
    myPlanData?.pending_plan_slug,
    payForPlan,
    setSearchParams,
  ])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-6.5rem)] items-center justify-center rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  const showPendingPay =
    myPlanData?.pending_plan_slug && (!currentPlan || myPlanData?.billing_status === 'none')
  const showRenew = (isExpired || inGrace) && currentPlan
  const cur = currentPlan?.currency === 'INR' ? '₹' : '$'

  return (
    <div className="relative flex h-[calc(100dvh-6.5rem)] max-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 via-white to-emerald-50/40 p-3 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 mb-2 flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-sm">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">Billing & Plans</h1>
              <p className="text-[11px] text-slate-500">
                Scale your workspace · Secure Razorpay checkout
              </p>
            </div>
          </div>
        </div>

        {currentPlan ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
            <div className="text-[11px] leading-snug">
              <span className="font-semibold text-slate-900">{currentPlan.name}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-medium text-slate-700">
                {cur}
                {currentPlan.price_monthly.toLocaleString()}/mo
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="text-slate-600">
                My Kit + {appsLimitLabel(myPlanData?.max_apps ?? currentPlan.max_apps)}
              </span>
              {expiryLabel ? (
                <>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="text-slate-500">Renews {expiryLabel}</span>
                </>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg border-slate-200 text-xs"
              onClick={() => navigate('/')}
            >
              Manage apps
            </Button>
          </div>
        ) : null}
      </header>

      {/* Alerts */}
      {(showPendingPay || showRenew) && (
        <div className="relative z-10 mb-2 flex shrink-0 flex-col gap-2">
          {showPendingPay ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] text-emerald-900">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                Complete payment for{' '}
                <strong className="capitalize">{myPlanData.pending_plan_slug}</strong> to unlock apps
              </div>
              <Button
                size="sm"
                className="h-7 gap-1 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
                disabled={payForPlan.isPending || !displayPlans.length}
                onClick={() => {
                  const target = displayPlans.find((p) => p.slug === myPlanData.pending_plan_slug)
                  if (target) payForPlan.mutate(target.id)
                }}
              >
                {payForPlan.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Pay now
              </Button>
            </div>
          ) : null}

          {showRenew ? (
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 shadow-sm',
                isExpired
                  ? 'border-red-200/80 bg-red-50/90 text-red-900'
                  : 'border-amber-200/80 bg-amber-50/90 text-amber-900',
              )}
            >
              <div className="flex items-center gap-2 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {isExpired
                  ? 'Subscription expired — renew to restore full access'
                  : 'Grace period active — renew soon to avoid interruption'}
              </div>
              <Button
                size="sm"
                className="h-7 gap-1 rounded-lg text-xs"
                disabled={payForPlan.isPending}
                onClick={() => payForPlan.mutate(currentPlan!.id)}
              >
                {payForPlan.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Renew
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Billing cycle + plans */}
      {displayPlans.length === 0 ? (
        <div className="relative z-10 flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
          No plans available — restart the API to seed Starter / Growth / Professional.
        </div>
      ) : (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Choose your plan
            </h2>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white/90 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                  billingCycle === 'monthly'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                  billingCycle === 'yearly'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 md:grid-cols-3 md:items-stretch">
            {displayPlans.map((plan) => (
              <div key={plan.id} className="min-h-0 h-full">
                <PlanCard
                  plan={plan}
                  currentPlan={currentPlan}
                  onSelect={(planId) => payForPlan.mutate(planId)}
                  isLoading={payForPlan.isPending}
                  billingCycle={billingCycle}
                />
              </div>
            ))}
          </div>

          {historyOpen ? (
            <div className="shrink-0 max-h-24 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
              {(paymentHistory?.payments ?? []).length === 0 ? (
                <p>No payments yet. Upgrade opens Razorpay so you can pay by card. The plan activates only after payment succeeds.</p>
              ) : (
                <ul className="space-y-1">
                  {(paymentHistory?.payments ?? []).map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {payment.plan_name} · {payment.currency === 'INR' ? '₹' : ''}{payment.amount.toLocaleString()} · {payment.status}
                      </span>
                      <span className="shrink-0 text-slate-400">
                        {payment.created_at
                          ? new Date(payment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : ''}
                        {payment.razorpay_payment_id ? ` · ${payment.razorpay_payment_id}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <footer className="flex shrink-0 items-center justify-between gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Secure payments via Razorpay · ~2% + GST ·{' '}
              <a href="mailto:support@kiterp.com" className="font-medium text-emerald-600 hover:underline">
                support@kiterp.com
              </a>
            </span>
            <button
              type="button"
              className="font-medium text-slate-600 hover:text-slate-900"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              Payment history{(paymentHistory?.payments?.length ?? 0) > 0 ? ` (${paymentHistory?.payments.length})` : ''}
            </button>
          </footer>
        </div>
      )}
    </div>
  )
}
