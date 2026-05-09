import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { CheckoutConfigProvider, type CheckoutLayout, type PaymentMode, useCheckoutConfig } from '@/checkout/config'
import { TwoColumnLayout } from '@/checkout/layouts/TwoColumnLayout'
import { WizardLayout } from '@/checkout/layouts/WizardLayout'
import { AccordionLayout } from '@/checkout/layouts/AccordionLayout'
import { CheckoutHeader, CheckoutFooter } from '@/checkout/components/Header'
import { useStoreBridgeCheckout } from '@/hooks/useStoreBridgeCheckout'
import { useCart, useStoreInfo } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { buildCheckoutThemeFromSiteStyle } from '@/checkout/buildCheckoutThemeFromSiteStyle'
import type { StyleConfig } from '@/blocks/registry'

export default function Checkout() {
  const { storePath } = useVendor()
  const { isAuthenticated, accessToken } = useAuthStore()
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: storeInfo } = useStoreInfo()
  const { builderSite } = useBuilderSite()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // Precedence: URL param (QA/demo) > wb_site style_config (website builder)
  //             > vendor theme_config (storefront builder) > theme.css default
  const siteLayout = (builderSite?.style_config as Partial<StyleConfig> | undefined)?.checkout_layout
  const themeLayout = (storeInfo as any)?.checkout_layout as CheckoutLayout | undefined
  const layout = (params.get('layout') as CheckoutLayout) || siteLayout || themeLayout || undefined
  const paymentMode = (params.get('payment') as PaymentMode) || undefined
  const storeName = (storeInfo as any)?.display_name ?? (storeInfo as any)?.business_name ?? 'Store'

  const checkoutTheme = builderSite?.style_config
    ? buildCheckoutThemeFromSiteStyle(builderSite.style_config as Partial<StyleConfig> & Record<string, unknown>)
    : undefined

  useEffect(() => {
    if (!cartLoading && (!isAuthenticated || !accessToken)) {
      navigate(storePath('/login'), { state: { from: storePath('/checkout') } })
    }
  }, [isAuthenticated, accessToken, cartLoading, navigate, storePath])

  if (cartLoading || (!isAuthenticated && accessToken === null)) {
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
        allowGuest: false,
        enabledProviders: ['stripe', 'paypal'],
        ...(layout && { layout }),
        ...(paymentMode && { paymentMode }),
      }}
    >
      <Inner storePath={storePath} layout={layout} checkoutTheme={checkoutTheme} />
    </CheckoutConfigProvider>
  )
}

function Inner({
  storePath,
  layout,
  checkoutTheme,
}: {
  storePath: (path: string) => string
  layout?: CheckoutLayout
  checkoutTheme?: React.CSSProperties
}) {
  const { layout: configLayout } = useCheckoutConfig()
  const checkout = useStoreBridgeCheckout()
  const activeLayout = layout ?? configLayout

  return (
    <div className="checkout-root" style={checkoutTheme}>
      <CheckoutHeader />
      {activeLayout === 'wizard'    && <WizardLayout    {...checkout} />}
      {activeLayout === 'accordion' && <AccordionLayout {...checkout} />}
      {(!activeLayout || activeLayout === 'two-column') && <TwoColumnLayout {...checkout} />}
      <CheckoutFooter />
    </div>
  )
}

