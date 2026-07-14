import { QrCode } from 'lucide-react'
import { useVendorStore } from '@/stores/vendorStore'
import { UpiCheckoutSettings } from '@/components/settings/UpiCheckoutSettings'

export default function UpiCheckoutPage() {
  const vendor = useVendorStore((s) => s.vendor)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
          <QrCode className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">UPI Checkout</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure shared or per–business-unit UPI QR payments for checkout.
          </p>
        </div>
      </div>

      <UpiCheckoutSettings vendor={vendor} />
    </div>
  )
}
