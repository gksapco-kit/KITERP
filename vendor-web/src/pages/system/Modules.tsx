import { useState, useEffect, useRef } from 'react'
import { useUpdateVendor } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2, Landmark, ShoppingBag, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Vendor } from '@/types'

const OFFERING_OPTIONS = [
  { value: 'products', label: 'Products Only', description: 'Sell physical or digital products.' },
  { value: 'services', label: 'Services Only', description: 'Offer services, bookings, or consultations.' },
  { value: 'both', label: 'Products & Services', description: 'Full catalog with both products and services.' },
]

const FINANCE_MODE_OPTIONS = [
  {
    value: 'basic',
    label: 'Basic Finance',
    description: 'Simple income, expense, salary and transfer tracking. Perfect for small businesses.',
  },
  {
    value: 'advanced',
    label: 'Advanced Finance (Full ERP)',
    description: 'Full chart of accounts, journal entries, AR/AP, budgets, reports and more.',
  },
]

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save Changes
    </Button>
  )
}

export default function ModulesPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()

  // Finance mode state
  const [financeMode, setFinanceMode] = useState<string>('advanced')
  const financeSavingRef = useRef(false)

  // Offering type state
  const [offeringType, setOfferingType] = useState<string>('both')
  const offeringSavingRef = useRef(false)

  useEffect(() => {
    if (vendor) {
      if (!financeSavingRef.current) {
        const mode = (vendor.settings as Record<string, unknown>)?.finance_mode as string | undefined
        setFinanceMode(mode ?? 'advanced')
      }
      if (!offeringSavingRef.current) {
        setOfferingType(vendor.offering_type || 'both')
      }
    }
  }, [vendor])

  const handleFinanceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    financeSavingRef.current = true
    updateVendor.mutate({
      settings: { ...existingSettings, finance_mode: financeMode },
    } as Partial<Vendor>, {
      onSuccess: () => toast.success('Finance module updated'),
      onSettled: () => { financeSavingRef.current = false },
    })
  }

  const handleOfferingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    offeringSavingRef.current = true
    updateVendor.mutate({
      offering_type: offeringType as 'products' | 'services' | 'both',
    } as Partial<Vendor>, {
      onSuccess: () => toast.success('Offering type updated'),
      onSettled: () => { offeringSavingRef.current = false },
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Module Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which modules and capabilities are active for your business.
        </p>
      </div>

      {/* Offering type */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <ShoppingBag className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <CardTitle className="text-base">Offering Type</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Controls which catalog tabs (Products / Services) are active in your storefront and sidebar.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOfferingSubmit} className="space-y-3">
            {OFFERING_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  offeringType === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <input
                  type="radio"
                  name="offering_type"
                  value={opt.value}
                  checked={offeringType === opt.value}
                  onChange={() => setOfferingType(opt.value)}
                  className="mt-0.5 w-4 h-4 text-primary"
                />
                <div>
                  <p className={cn('text-sm font-semibold', offeringType === opt.value ? 'text-primary' : 'text-foreground')}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
            <div className="flex justify-end pt-2">
              <SaveButton loading={updateVendor.isPending} />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Finance module */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <Landmark className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <CardTitle className="text-base">Finance Module</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose how the Finance section appears in the sidebar and which features are available.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFinanceSubmit} className="space-y-3">
            {FINANCE_MODE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  financeMode === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <input
                  type="radio"
                  name="finance_mode"
                  value={opt.value}
                  checked={financeMode === opt.value}
                  onChange={() => setFinanceMode(opt.value)}
                  className="mt-0.5 w-4 h-4 text-primary"
                />
                <div>
                  <p className={cn('text-sm font-semibold', financeMode === opt.value ? 'text-primary' : 'text-foreground')}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
            <div className="flex justify-end pt-2">
              <SaveButton loading={updateVendor.isPending} />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Coming soon: more toggles */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-5 flex items-center gap-3 text-muted-foreground">
          <ToggleRight className="w-5 h-5 shrink-0" />
          <p className="text-sm">More module toggles (POS, Bookings, Restaurant, Subscriptions) coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
