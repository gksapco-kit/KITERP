export type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal?: { ondismiss?: () => void }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void }
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

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const loaded = await loadRazorpayScript()
  if (!loaded || !window.Razorpay) {
    throw new Error('Could not load payment gateway')
  }
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => {
        Promise.resolve(options.handler(response))
          .then(() => resolve())
          .catch(reject)
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

/** Dev-mode mock when backend returns dev_mode without real Razorpay keys. */
export async function mockRazorpayPay(
  razorpayOrderId: string,
): Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }> {
  return {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: `pay_dev_${Date.now()}`,
    razorpay_signature: 'dev_sig',
  }
}
