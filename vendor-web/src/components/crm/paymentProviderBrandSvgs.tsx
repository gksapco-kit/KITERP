import type { ReactNode } from 'react'
import type { PaymentProviderId } from './paymentProvidersCatalog'

function svg(content: ReactNode) {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid meet">
      {content}
    </svg>
  )
}

/** Brand-accurate 32×32 marks for payment provider cards */
export const PAYMENT_PROVIDER_BRAND_SVGS: Record<PaymentProviderId, ReactNode> = {
  razorpay: svg(
    <>
      <path fill="#072654" d="M5 24 L16 10 L16 24 Z" />
      <path fill="#3395FF" d="M14 24 L25 10 L25 24 Z" />
    </>,
  ),
  stripe: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#635BFF" />
      <path
        fill="#FFFFFF"
        d="M14.2 12.5c0-.9.7-1.2 1.8-1.2 1.6 0 3.6.5 5.2 1.3V9.8c-1.7-.7-3.4-1-5.2-1-4.2 0-7 2.2-7 5.8 0 5.7 7.8 4.8 7.8 7.3 0 1.1-.9 1.4-2.2 1.4-1.9 0-4.4-.8-6.3-1.8v4.5c2.1.9 4.2 1.3 6.3 1.3 4.3 0 7.2-2.1 7.2-5.9 0-6.1-7.9-5-7.9-7.4z"
      />
    </>,
  ),
  square: svg(
    <>
      <rect x="4" y="4" width="24" height="24" rx="4" fill="#000000" />
      <rect x="10" y="10" width="12" height="12" rx="1" fill="#FFFFFF" />
    </>,
  ),
  paypal: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#FFFFFF" />
      <path
        fill="#003087"
        d="M11.5 8.5h6c2.6 0 4.4 1.6 4.4 4.1 0 2.7-1.9 4.4-4.9 4.4h-2.2l-.8 5.5h-3.4l2.9-14zm4.2 6.5c1.4 0 2.1-.7 2.1-1.9 0-1.1-.7-1.8-2-1.8h-1.5l-.6 3.7h1.6z"
      />
      <path
        fill="#009CDE"
        d="M20 8.5h6c2.6 0 4.4 1.6 4.4 4.1 0 2.7-1.9 4.4-4.9 4.4H23l-.8 5.5h-3.4L21.7 8.5H20zm4.2 6.5c1.4 0 2.1-.7 2.1-1.9 0-1.1-.7-1.8-2-1.8h-1.5l-.6 3.7h1.6z"
      />
    </>,
  ),
  payu: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#000000" />
      <path
        fill="#FFFFFF"
        d="M8 10h5.5c2.2 0 3.6 1.2 3.6 3.1 0 2.1-1.8 3.4-4.4 3.4H10.8L10 22H7L8 10zm4.8 4.8c1 0 1.6-.5 1.6-1.3 0-.7-.5-1.1-1.5-1.1H10.5v2.4h2.3z"
      />
      <path fill="#A6CE39" d="M18 10h3l-1 12h-3l1-12z" />
    </>,
  ),
  sepa_direct_debit: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#003399" />
      <circle cx="16" cy="14" r="5.5" fill="none" stroke="#FFCC00" strokeWidth="1.5" />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const cx = 16 + Math.cos(rad) * 3.8
        const cy = 14 + Math.sin(rad) * 3.8
        return <circle key={i} cx={cx} cy={cy} r="0.9" fill="#FFCC00" />
      })}
      <rect x="8" y="21" width="16" height="2.5" rx="1.2" fill="#FFFFFF" opacity="0.9" />
    </>,
  ),
  wire_transfer: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#475569" />
      <path fill="#FFFFFF" d="M16 7 L24 12 V20 L16 25 L8 20 V12 Z" opacity="0.95" />
      <rect x="13" y="13" width="6" height="8" rx="0.5" fill="#475569" />
      <rect x="11" y="16" width="2" height="5" fill="#475569" />
      <rect x="19" y="16" width="2" height="5" fill="#475569" />
      <rect x="14.5" y="11" width="3" height="2" rx="0.5" fill="#475569" />
    </>,
  ),
  demo: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#714B67" />
      <circle cx="16" cy="11" r="2.2" fill="#FFFFFF" />
      <circle cx="11" cy="16" r="2.2" fill="#FFFFFF" opacity="0.9" />
      <circle cx="21" cy="16" r="2.2" fill="#FFFFFF" opacity="0.9" />
      <circle cx="16" cy="21" r="2.2" fill="#FFFFFF" opacity="0.85" />
    </>,
  ),
  adyen: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#0ABF53" />
      <path fill="#FFFFFF" d="M10.5 22 L16 9 L21.5 22 H18.5 L16 16.2 L13.5 22 Z" />
      <path fill="#FFFFFF" opacity="0.85" d="M14 22 L16 17 L18 22 Z" />
    </>,
  ),
  amazon_payment_services: (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="32" height="32" rx="4" fill="#000000" />
      <text
        x="16"
        y="13.8"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#FFFFFF"
        fontSize="20"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        a
      </text>
      <path
        fill="none"
        stroke="#FF9900"
        strokeWidth="2.4"
        strokeLinecap="round"
        d="M7.5 20.5 Q16 22.4 24.5 20.5"
      />
      <path fill="#FF9900" d="M23.2 19.2 L26.2 20.8 L23.2 22.4 Z" />
    </svg>
  ),
  asiapay: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#E31837" />
      <path
        fill="#FFFFFF"
        d="M10 10h4.2c2.4 0 4 1.4 4 3.5 0 2.4-2 3.8-4.8 3.8H12.6L11.8 22H9l1-12zm3.8 5.2c1.2 0 1.9-.6 1.9-1.6 0-.9-.6-1.4-1.8-1.4H12.4v3h1.4z"
      />
      <path fill="#FFFFFF" d="M19.5 10h2.8l-2.2 12h-2.8l2.2-12z" />
      <circle cx="23" cy="13" r="2" fill="#FFFFFF" opacity="0.9" />
    </>,
  ),
  authorize_net: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#008CC9" />
      <circle cx="16" cy="16" r="8" fill="#FFFFFF" opacity="0.15" />
      <path
        fill="#F7931E"
        d="M11 18.5c2-3.5 4.5-5.5 7.5-6.5 2.5-.8 5-.5 6.8 1.2-2.2 1.2-4.5 2-7 2.4-2 .3-4.5.1-7.3-2.1z"
      />
      <path fill="#FFFFFF" d="M12 12h8v1.6H12V12zm0 3h5.5v1.6H12V15z" opacity="0.95" />
    </>,
  ),
  buckaroo: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#00AEEF" />
      <ellipse cx="16" cy="17" rx="7" ry="6" fill="#FFFFFF" />
      <circle cx="13.5" cy="15.5" r="1.1" fill="#00AEEF" />
      <circle cx="18.5" cy="15.5" r="1.1" fill="#00AEEF" />
      <path fill="none" stroke="#00AEEF" strokeWidth="1.2" d="M13 18.5c1 1.2 2.2 1.8 3 1.8s2-.6 3-1.8" />
      <ellipse cx="20" cy="11" rx="2.5" ry="3" fill="#FFFFFF" transform="rotate(25 20 11)" />
    </>,
  ),
  flutterwave: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#FB9129" />
      <path
        fill="#FFFFFF"
        d="M6 17c3.5-2 7-3 10.5-3 3.2 0 6.3.8 9 2.5-2.8 2.2-6 3.5-9.5 3.5-3.8 0-7.2-1.1-10-3z"
      />
      <path
        fill="#FFFFFF"
        opacity="0.85"
        d="M8 13.5c2.5-1.2 5.2-1.8 8-1.8 2.5 0 5 .5 7.2 1.5"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        fill="none"
      />
    </>,
  ),
  mercado_pago: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#00BCFF" />
      <circle cx="16" cy="16" r="9" fill="#FFFFFF" opacity="0.95" />
      <path
        fill="#00BCFF"
        d="M11.5 17.5c1.5-2 3.2-3 5-3 1.5 0 2.8.7 3.8 2-1.5 1.5-3.2 2.3-5 2.3-1.6 0-3-.5-3.8-1.3z"
      />
      <path fill="#009EE3" d="M12 13.5c.8-1 1.8-1.5 3-1.5 1 0 1.9.4 2.6 1.2-1 .9-2.1 1.4-3.3 1.4-1.1 0-2-.3-2.3-.9z" />
      <path fill="#009EE3" d="M17.5 13.5c.8-1 1.8-1.5 3-1.5 1 0 1.9.4 2.6 1.2-1 .9-2.1 1.4-3.3 1.4-1.1 0-2-.3-2.3-.9z" />
    </>,
  ),
  mollie: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#000000" />
      <path
        fill="#FFFFFF"
        d="M11 22 V12.5c0-1.8 1.2-3 3-3 1.4 0 2.3.7 2.8 1.8.5-1.1 1.4-1.8 2.7-1.8 1.8 0 3 1.2 3 3V22h-2.4v-9.2c0-1-.5-1.6-1.4-1.6-.9 0-1.5.6-1.5 1.6V22h-2.2v-9.2c0-1-.5-1.6-1.4-1.6-.9 0-1.5.6-1.5 1.6V22H11z"
      />
    </>,
  ),
  sips: svg(
    <>
      <rect width="32" height="32" rx="6" fill="#005EB8" />
      <rect x="8" y="10" width="16" height="12" rx="2" fill="#FFFFFF" />
      <rect x="10" y="13" width="5" height="3" rx="0.5" fill="#005EB8" opacity="0.7" />
      <rect x="10" y="17.5" width="8" height="1.5" rx="0.5" fill="#94A3B8" />
      <path fill="#FFFFFF" d="M21 10h2v3h-2v-3z" />
    </>,
  ),
}

export const PAYMENT_PROVIDER_ACCENTS: Record<PaymentProviderId, string> = {
  razorpay: '#3395FF',
  stripe: '#635BFF',
  square: '#000000',
  paypal: '#003087',
  payu: '#A6CE39',
  sepa_direct_debit: '#003399',
  wire_transfer: '#475569',
  demo: '#714B67',
  adyen: '#0ABF53',
  amazon_payment_services: '#FF9900',
  asiapay: '#E31837',
  authorize_net: '#008CC9',
  buckaroo: '#00AEEF',
  flutterwave: '#FB9129',
  mercado_pago: '#00BCFF',
  mollie: '#000000',
  sips: '#005EB8',
}
