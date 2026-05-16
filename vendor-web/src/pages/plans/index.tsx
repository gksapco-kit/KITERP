import { useState } from 'react'
import { useMyPlan, useAvailablePlans, useChangePlan } from '@/hooks/useVendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CreditCard, Check, ArrowUp, ArrowDown, Loader2,
  Smartphone, Globe, BarChart3, Code, Headphones, Tag, Package, Wrench, Users, HardDrive,
  Zap, AlertCircle,
} from 'lucide-react'
import type { VendorPlanInfo } from '@/types'

const FEATURE_META: Record<string, { label: string; icon: typeof Smartphone }> = {
  branded_app: { label: 'Branded App', icon: Smartphone },
  custom_domain: { label: 'Custom Domain', icon: Globe },
  analytics: { label: 'Analytics', icon: BarChart3 },
  api_access: { label: 'API Access', icon: Code },
  priority_support: { label: 'Priority Support', icon: Headphones },
  white_label: { label: 'White Label', icon: Tag },
}

function PlanBadge({ current, featured }: { current?: boolean; featured?: boolean }) {
  if (current) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
      <Check className="w-3 h-3" /> Current Plan
    </span>
  )
  if (featured) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      <Zap className="w-3 h-3" /> Popular
    </span>
  )
  return null
}

function PlanCard({
  plan,
  currentPlan,
  onSelect,
  isLoading,
}: {
  plan: VendorPlanInfo
  currentPlan: VendorPlanInfo | null
  onSelect: (planId: string) => void
  isLoading: boolean
}) {
  const isCurrent = currentPlan?.id === plan.id
  const isUpgrade = currentPlan && plan.price_monthly > currentPlan.price_monthly
  const isDowngrade = currentPlan && plan.price_monthly < currentPlan.price_monthly
  const [confirming, setConfirming] = useState(false)

  const handleClick = () => {
    if (isCurrent) return
    if (!confirming) { setConfirming(true); return }
    setConfirming(false)
    onSelect(plan.id)
  }

  const cur = plan.currency === 'INR' ? '₹' : '$'

  return (
    <Card className={`relative flex flex-col transition-all ${
      isCurrent
        ? 'border-blue-400 ring-2 ring-blue-200'
        : plan.is_featured
        ? 'border-yellow-300 ring-1 ring-yellow-200 shadow-md'
        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      {/* Top badge */}
      <div className="absolute -top-3 left-4">
        <PlanBadge current={isCurrent} featured={!isCurrent && plan.is_featured} />
      </div>

      <CardHeader className="pb-2 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            {plan.description && (
              <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {cur}{plan.price_monthly.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">/month</div>
            {plan.price_yearly && (
              <div className="text-xs text-green-600 font-medium mt-0.5">
                {cur}{plan.price_yearly.toLocaleString()}/yr
                <span className="text-gray-400 font-normal"> (save {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}%)</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Features */}
        <div className="space-y-2">
          {Object.entries(FEATURE_META).map(([key, meta]) => {
            const enabled = plan.features?.[key] ?? false
            const Icon = meta.icon
            return (
              <div key={key} className={`flex items-center gap-2.5 text-sm ${enabled ? 'text-gray-800' : 'text-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {enabled
                    ? <Check className="w-2.5 h-2.5 text-green-600" />
                    : <div className="w-1.5 h-0.5 bg-gray-300 rounded" />}
                </div>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={enabled ? '' : 'line-through'}>{meta.label}</span>
              </div>
            )
          })}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            <span>{plan.max_products === -1 ? 'Unlimited' : plan.max_products} Products</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Wrench className="w-3.5 h-3.5 text-gray-400" />
            <span>{plan.max_services === -1 ? 'Unlimited' : plan.max_services} Services</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>{plan.max_team_members} Team Members</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <HardDrive className="w-3.5 h-3.5 text-gray-400" />
            <span>{plan.max_storage_mb >= 1000 ? `${plan.max_storage_mb / 1000}GB` : `${plan.max_storage_mb}MB`} Storage</span>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-2">
          {isCurrent ? (
            <div className="w-full py-2.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium text-center flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> Active Plan
            </div>
          ) : confirming ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {isUpgrade
                    ? `Upgrade to ${plan.name}? Your new features will be active immediately.`
                    : `Downgrade to ${plan.name}? Some features may become unavailable.`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 gap-1.5 ${isUpgrade ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'} text-white`}
                  onClick={handleClick}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isUpgrade
                    ? <ArrowUp className="w-4 h-4" />
                    : <ArrowDown className="w-4 h-4" />}
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant={isUpgrade ? 'default' : 'outline'}
              className={`w-full gap-2 ${isUpgrade ? 'bg-primary hover:bg-primary/90 text-white' : ''}`}
              onClick={handleClick}
              disabled={isLoading}
            >
              {isUpgrade ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              {isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PlansPage() {
  const { data: myPlanData, isLoading: planLoading } = useMyPlan()
  const { data: availablePlans, isLoading: plansLoading } = useAvailablePlans()
  const changePlan = useChangePlan()

  const currentPlan = myPlanData?.plan ?? null
  const isLoading = planLoading || plansLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600" /> Billing & Plans
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upgrade or downgrade your plan at any time. Changes take effect immediately.
        </p>
      </div>

      {/* Current Plan Summary */}
      {currentPlan ? (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Active Plan</p>
                  <p className="font-bold text-gray-900 text-lg">{currentPlan.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div>
                  <span className="text-gray-400 text-xs block">Monthly</span>
                  <span className="font-bold text-gray-900">
                    {currentPlan.currency === 'INR' ? '₹' : '$'}{currentPlan.price_monthly.toLocaleString()}
                  </span>
                </div>
                {currentPlan.price_yearly && (
                  <div>
                    <span className="text-gray-400 text-xs block">Yearly</span>
                    <span className="font-bold text-green-700">
                      {currentPlan.currency === 'INR' ? '₹' : '$'}{currentPlan.price_yearly.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 max-w-xs">
                  {Object.entries(currentPlan.features || {})
                    .filter(([, v]) => v)
                    .map(([key]) => (
                      <span key={key} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {FEATURE_META[key]?.label ?? key.replace(/_/g, ' ')}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">No plan assigned</p>
              <p className="text-sm text-amber-600">Contact your administrator or choose a plan below.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      {!availablePlans || availablePlans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">No plans available</p>
            <p className="text-sm mt-1">Contact your administrator to set up plans.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {availablePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPlan={currentPlan}
                  onSelect={(planId) => changePlan.mutate(planId)}
                  isLoading={changePlan.isPending}
                />
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-400 text-center">
            Need a custom plan? Contact us at{' '}
            <a href="mailto:support@kiterp.com" className="text-blue-500 hover:underline">
              support@kiterp.com
            </a>
          </p>
        </>
      )}
    </div>
  )
}
