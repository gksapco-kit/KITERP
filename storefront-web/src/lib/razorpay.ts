export type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  /** Razorpay Dashboard → Payment Configuration ID (optional). */
  checkout_config_id?: string
  /** Request enabled payment methods — UPI still requires Razorpay account provisioning. */
  method?: Partial<Record<'upi' | 'card' | 'netbanking' | 'wallet' | 'paylater', boolean>>
  config?: {
    display?: {
      blocks?: Record<string, { name: string; instruments: Array<{ method: string; banks?: string[] }> }>
      sequence?: string[]
      preferences?: { show_default_blocks?: boolean }
    }
  }
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  modal?: { ondismiss?: () => void }
}

/** Prioritise UPI when the merchant account has it enabled on Razorpay. */
export function buildRazorpayCheckoutOptions(
  base: Omit<RazorpayCheckoutOptions, 'method' | 'config'>,
): RazorpayCheckoutOptions {
  const methods = {
    upi: true,
    card: true,
    netbanking: true,
    wallet: true,
    paylater: true,
  } as const

  if (base.checkout_config_id) {
    return { ...base, method: { ...methods } }
  }

  return {
    ...base,
    method: { ...methods },
    config: {
      display: {
        blocks: {
          upi: {
            name: 'Pay via UPI',
            instruments: [{ method: 'upi' }],
          },
        },
        sequence: ['block.upi'],
        preferences: {
          show_default_blocks: true,
        },
      },
    },
  }
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
      ...buildRazorpayCheckoutOptions(options),
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
