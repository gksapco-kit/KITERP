import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { usePlans, useCreatePlan, useUpdatePlanFeatures } from '@/hooks/usePlans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CreditCard,
  Plus,
  Loader2,
  X,
  Smartphone,
  Globe,
  BarChart3,
  Code,
  Headphones,
  Tag,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'

const FEATURE_META: Record<string, { label: string; icon: typeof Smartphone; description: string }> = {
  branded_app: { label: 'Branded App', icon: Smartphone, description: 'White-label Android/iOS app for the vendor' },
  custom_domain: { label: 'Custom Domain', icon: Globe, description: 'Use their own domain name' },
  analytics: { label: 'Analytics', icon: BarChart3, description: 'Access to analytics dashboard' },
  api_access: { label: 'API Access', icon: Code, description: 'Programmatic API access' },
  priority_support: { label: 'Priority Support', icon: Headphones, description: 'Faster support response' },
  white_label: { label: 'White Label', icon: Tag, description: 'Remove KITERP branding' },
}

export default function Plans() {
  const { user } = useAuthStore()
  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }
  const { data: plans, isLoading } = usePlans()
  const createPlan = useCreatePlan()
  const updateFeatures = useUpdatePlanFeatures()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
  })

  const handleCreate = () => {
    if (!form.name || !form.slug || !form.price_monthly) return
    createPlan.mutate(
      {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        price_monthly: parseFloat(form.price_monthly),
        price_yearly: form.price_yearly ? parseFloat(form.price_yearly) : undefined,
        features: {
          custom_domain: false,
          analytics: true,
          api_access: false,
          priority_support: false,
          white_label: false,
          branded_app: false,
        },
      },
      {
        onSuccess: () => {
          setShowCreate(false)
          setForm({ name: '', slug: '', description: '', price_monthly: '', price_yearly: '' })
        },
      }
    )
  }

  const handleToggleFeature = (planId: string, currentFeatures: Record<string, boolean>, featureKey: string) => {
    updateFeatures.mutate({
      planId,
      features: { [featureKey]: !currentFeatures[featureKey] },
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Vendor Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage plans and feature flags. Toggle <strong>Branded App</strong> to allow vendors to get a custom mobile app.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      {/* Create Plan Modal */}
      {showCreate && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">New Plan</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Plan Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setForm({
                      ...form,
                      name,
                      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                    })
                  }}
                  placeholder="Pro"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="pro"
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="For growing businesses"
                />
              </div>
              <div>
                <Label>Monthly Price (INR)</Label>
                <Input
                  type="number"
                  value={form.price_monthly}
                  onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
                  placeholder="999"
                />
              </div>
              <div>
                <Label>Yearly Price (INR)</Label>
                <Input
                  type="number"
                  value={form.price_yearly}
                  onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
                  placeholder="9999"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={createPlan.isPending || !form.name || !form.price_monthly} className="w-full">
                  {createPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Create Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans List */}
      {!plans || plans.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">No plans yet</p>
            <p className="text-sm mt-1">Create your first plan to start assigning features to vendors.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative">
              {plan.is_featured && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  Featured
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{plan.slug}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {plan.currency === 'INR' ? '₹' : '$'}{plan.price_monthly}
                    </p>
                    <p className="text-xs text-gray-500">/month</p>
                    {plan.price_yearly && (
                      <p className="text-xs text-gray-400">
                        {plan.currency === 'INR' ? '₹' : '$'}{plan.price_yearly}/yr
                      </p>
                    )}
                  </div>
                </div>
                {plan.description && (
                  <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Features</p>
                <div className="space-y-2">
                  {Object.entries(FEATURE_META).map(([key, meta]) => {
                    const enabled = plan.features?.[key] ?? false
                    const Icon = meta.icon
                    return (
                      <button
                        key={key}
                        onClick={() => handleToggleFeature(plan.id, plan.features || {}, key)}
                        disabled={updateFeatures.isPending}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                          enabled
                            ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                            : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{meta.label}</span>
                          <p className="text-xs opacity-70 truncate">{meta.description}</p>
                        </div>
                        <div
                          className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                            enabled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              enabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Limits */}
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-4 mb-2">Limits</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Products:</span>{' '}
                    <span className="font-medium">{plan.max_products === -1 ? 'Unlimited' : plan.max_products}</span>
                  </div>
                  <div className="bg-gray-50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Services:</span>{' '}
                    <span className="font-medium">{plan.max_services === -1 ? 'Unlimited' : plan.max_services}</span>
                  </div>
                  <div className="bg-gray-50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Team:</span>{' '}
                    <span className="font-medium">{plan.max_team_members}</span>
                  </div>
                  <div className="bg-gray-50 rounded px-2 py-1.5">
                    <span className="text-gray-500">Storage:</span>{' '}
                    <span className="font-medium">{plan.max_storage_mb}MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
