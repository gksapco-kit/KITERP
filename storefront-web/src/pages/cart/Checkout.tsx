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
import { useCompletePendingCheckoutIntent } from '@/hooks/useCompletePendingCheckoutIntent'
import { isSignInMandatory } from '@/lib/deliveryConditions'
import { useIsCustomerLoggedIn } from '@/hooks/useAuthHydrated'
import { peekPendingCheckoutIntent } from '@/lib/pendingCheckoutIntent'
import { useCartStore } from '@/stores/cartStore'
import type { StyleConfig } from '@/blocks/registry'

/** Stable shell so auth/cart hydration does not flash a blank spinner. */
function CheckoutPageSkeleton() {
  return (
    <div className="checkout-root mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 py-6 sm:px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:items-start lg:gap-8 animate-in fade-in duration-200">
      <div className="order-2 space-y-4 lg:order-1">
        <div className="ck-surface ck-border ck-radius-md h-14 animate-pulse bg-gray-100/80" />
        <div className="ck-surface ck-border ck-radius-md h-36 animate-pulse bg-gray-100/80" />
        <div className="ck-surface ck-border ck-radius-md h-52 animate-pulse bg-gray-100/80" />
        <div className="ck-surface ck-border ck-radius-md h-40 animate-pulse bg-gray-100/80" />
      </div>
      <div className="order-1 lg:order-2">
        <div className="ck-surface ck-border ck-radius-md h-72 animate-pulse bg-gray-100/80 lg:sticky lg:top-20" />
      </div>
    </div>
  )
}

export default function Checkout() {
  const { storePath } = useBranch()
  const { vendor, vendorSlug } = useVendor()
  const location = useLocation()
  const { ready: authReady, isLoggedIn } = useIsCustomerLoggedIn()
  const { completing: completingBuyNow } = useCompletePendingBuyNow()
  const { completing: completingCheckoutIntent } = useCompletePendingCheckoutIntent()
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: storeInfo } = useStoreInfo()
  const { builderSite } = useBuilderSite()
  const [params] = useSearchParams()

  const localCart = useCartStore((s) => s.cart)
  const pendingIntent = vendorSlug ? peekPendingCheckoutIntent(vendorSlug) : null
  const hasCartItems =
    (cart?.items?.length ?? 0) > 0
    || (localCart?.items?.length ?? 0) > 0
    || !!pendingIntent?.cartItem

  const smoothEntry = !!(location.state as { smoothCheckoutEntry?: boolean } | null)?.smoothCheckoutEntry
  const waitingForCart =
    !hasCartItems
    && (cartLoading || completingBuyNow || completingCheckoutIntent)

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

  // Wait for auth rehydrate so a logged-in user is not bounced to login/signup
  if (!authReady) {
    return (
      <div className="checkout-root relative min-h-[70vh]" style={checkoutTheme}>
        <CheckoutPageSkeleton />
      </div>
    )
  }

  if (requireSignIn && !isLoggedIn) {
    return (
      <Navigate
        to={storePath('/login')}
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  if (waitingForCart) {
    return (
      <div className="checkout-root relative min-h-[70vh]" style={checkoutTheme}>
        {smoothEntry ? (
          <CheckoutPageSkeleton />
        ) : (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
      </div>
    )
  }

  if (!cart?.items?.length && !localCart?.items?.length && !pendingIntent?.cartItem) {
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
        paymentMode:
          checkout.state.connectedPayments.length > 0 || checkout.state.previewLoading
            ? 'providers'
            : 'tabs',
        manualUpi: checkout.state.manualUpi ?? null,
        logoUrl: (storeInfo as { logo_url?: string } | undefined)?.logo_url,
        paymentsLoading: !!checkout.state.previewLoading,
      }}
    >
      <div
        className="checkout-root relative min-h-[70vh] animate-in fade-in duration-300"
        style={checkoutTheme}
      >
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
