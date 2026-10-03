export type RazorpayPaymentResult = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  handler?: (response: RazorpayPaymentResult) => void
  modal?: { ondismiss?: () => void }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions & {
      handler: (response: RazorpayPaymentResult) => void
    }) => { open: () => void }
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(!!window.Razorpay)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/** Opens Razorpay Checkout and resolves with the payment result. */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpayPaymentResult> {
  const loaded = await loadRazorpayScript()
  if (!loaded || !window.Razorpay) {
    throw new Error('Could not load payment gateway')
  }
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => {
        try {
          options.handler?.(response)
        } catch {
          /* ignore optional handler errors */
        }
        resolve(response)
      },
      modal: {
        ...options.modal,
        ondismiss: () => {
          options.modal?.ondismiss?.()
          reject(new Error('Payment cancelled'))
        },
      },
    })
    rzp.open()
  })
}

export async function mockRazorpayPay(razorpayOrderId: string): Promise<RazorpayPaymentResult> {
  return {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: `pay_dev_${Date.now()}`,
    razorpay_signature: 'dev_sig',
  }
}
