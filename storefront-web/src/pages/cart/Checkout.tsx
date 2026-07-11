import { useSearchParams, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { CheckoutConfigProvider, type CheckoutLayout, type PaymentMode, useCheckoutConfig } from '@/checkout/config'
import { TwoColumnLayout } from '@/checkout/layouts/TwoColumnLayout'
import { WizardLayout } from '@/checkout/layouts/WizardLayout'
import { AccordionLayout } from '@/checkout/layouts/AccordionLayout'
import { CheckoutHeader, CheckoutFooter } from '@/checkout/components/Header'
import { CheckoutProcessingOverlay } from '@/checkout/components/CheckoutProcessingOverlay'
import { useStoreBridgeCheckout } from '@/hooks/useStoreBridgeCheckout'
import { useCart, useStoreInfo } from '@/hooks/useStore'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useBuilderSiteCheckoutTheme } from '@/hooks/useBuilderSiteCheckoutTheme'
import { useCompletePendingBuyNow } from '@/hooks/useCompletePendingBuyNow'
import { useAuthStore } from '@/stores/authStore'
import { isSignInMandatory } from '@/lib/deliveryConditions'
import type { StyleConfig } from '@/blocks/registry'

export default function Checkout() {
  const { storePath } = useBranch()
  const { vendor } = useVendor()
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const { completing: completingBuyNow } = useCompletePendingBuyNow()
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: storeInfo } = useStoreInfo()
  const { builderSite } = useBuilderSite()
  const [params] = useSearchParams()

  const hasCartItems = (cart?.items?.length ?? 0) > 0
  const waitingForCart = cartLoading && !hasCartItems
  const requireSignIn = isSignInMandatory(
    (vendor?.settings ?? {}) as Record<string, unknown>,
  )
  const allowGuest = !requireSignIn

  // Precedence: URL param (QA/demo) > wb_site style_config (website builder)
  //             > vendor theme_config > theme.css default
  const siteLayout = (builderSite?.style_config as Partial<StyleConfig> | undefined)?.checkout_layout
  const themeLayout = (storeInfo as any)?.checkout_layout as CheckoutLayout | undefined
  const layout = (params.get('layout') as CheckoutLayout) || siteLayout || themeLayout || undefined
  const paymentMode = (params.get('payment') as PaymentMode) || undefined
  const storeName = (storeInfo as any)?.display_name ?? (storeInfo as any)?.business_name ?? 'Store'

  const checkoutTheme = useBuilderSiteCheckoutTheme()

  if (requireSignIn && !isAuthenticated) {
    return (
      <Navigate
        to={storePath('/login')}
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  if (waitingForCart || (completingBuyNow && !hasCartItems)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!cart?.items?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg font-medium text-gray-600">Your cart is empty</p>
        <a href={storePath('/products')} className="ck-btn-primary no-underline" style={{ width: 'auto', padding: '12px 24px' }}>
          Continue shopping
        </a>
      </div>
    )
  }

  return (
    <CheckoutConfigProvider
      config={{
        storeName,
        showSavedAddresses: true,
        showCoupon: true,
        showOrderNotes: true,
        showTrustBadges: true,
        showTaxBreakdown: true,
        showShippingMethods: true,
        allowGuest,
        paymentMode: 'providers',
        ...(layout && { layout }),
        ...(paymentMode && { paymentMode }),
      }}
    >
      <Inner storePath={storePath} layout={layout} checkoutTheme={checkoutTheme} storeName={storeName} />
    </CheckoutConfigProvider>
  )
}

function Inner({
  storePath,
  layout,
  checkoutTheme,
  storeName,
}: {
  storePath: (path: string) => string
  layout?: CheckoutLayout
  checkoutTheme?: React.CSSProperties
  storeName: string
}) {
  const checkout = useStoreBridgeCheckout()
  const { layout: configLayout } = useCheckoutConfig()
  const { data: storeInfo } = useStoreInfo()
  const activeLayout = layout ?? configLayout

  return (
    <CheckoutConfigProvider
      config={{
        storeName,
        connectedPayments: checkout.state.connectedPayments,
        codEnabled: checkout.state.codEnabled,
        paymentMode: checkout.state.connectedPayments.length > 0 ? 'providers' : 'tabs',
        manualUpi: checkout.state.manualUpi ?? null,
        logoUrl: (storeInfo as { logo_url?: string } | undefined)?.logo_url,
      }}
    >
      <div className="checkout-root relative" style={checkoutTheme}>
        {checkout.state.processingMessage ? (
          <CheckoutProcessingOverlay message={checkout.state.processingMessage} />
        ) : null}
        {checkout.state.error ? (
          <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 md:px-6">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {checkout.state.error}
            </p>
          </div>
        ) : null}
        <CheckoutHeader />
        {activeLayout === 'wizard'    && <WizardLayout    {...checkout} />}
        {activeLayout === 'accordion' && <AccordionLayout {...checkout} />}
        {(!activeLayout || activeLayout === 'two-column') && <TwoColumnLayout {...checkout} />}
        <CheckoutFooter />
      </div>
    </CheckoutConfigProvider>
  )
}

