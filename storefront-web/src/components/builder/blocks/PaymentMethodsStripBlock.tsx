import type { JSX } from 'react'
import { Banknote, CreditCard, Smartphone } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField, visibleArrayEntries } from '@/lib/blockHiddenFields'
import {
  DEFAULT_PAYMENT_METHOD_KEYS,
  paymentMethodLabel,
  normalizePaymentMethodKey,
  readPaymentMethodKeys,
} from '@/lib/paymentMethodCatalog'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

interface Method {
  label: string
  render: () => JSX.Element
  ariaLabel: string
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center min-w-[56px] h-9 px-2.5 rounded-md border border-gray-200 bg-white text-xs font-medium tracking-wider ${className}`}
    >
      {children}
    </div>
  )
}

const METHODS: Record<string, Method> = {
  visa: {
    label: 'Visa',
    ariaLabel: 'Visa accepted',
    render: () => (
      <Badge>
        <span className="text-[#1a1f71] italic font-extrabold tracking-tight">VISA</span>
      </Badge>
    ),
  },
  mastercard: {
    label: 'Mastercard',
    ariaLabel: 'Mastercard accepted',
    render: () => (
      <Badge>
        <span className="relative inline-flex">
          <span className="block w-4 h-4 rounded-full bg-[#eb001b]" />
          <span className="block w-4 h-4 rounded-full bg-[#f79e1b] -ml-1.5 mix-blend-multiply" />
        </span>
      </Badge>
    ),
  },
  amex: {
    label: 'American Express',
    ariaLabel: 'American Express accepted',
    render: () => (
      <Badge className="!bg-[#2e77bb]">
        <span className="text-white font-extrabold">AMEX</span>
      </Badge>
    ),
  },
  paypal: {
    label: 'PayPal',
    ariaLabel: 'PayPal accepted',
    render: () => (
      <Badge>
        <span className="text-[#003087] font-extrabold italic">Pay</span>
        <span className="text-[#0070ba] font-extrabold italic">Pal</span>
      </Badge>
    ),
  },
  stripe: {
    label: 'Stripe',
    ariaLabel: 'Stripe payments',
    render: () => (
      <Badge>
        <span className="text-[#635bff] font-extrabold lowercase tracking-tight">stripe</span>
      </Badge>
    ),
  },
  razorpay: {
    label: 'Razorpay',
    ariaLabel: 'Razorpay payments',
    render: () => (
      <Badge>
        <span className="text-[#3395ff] font-extrabold lowercase tracking-tight">razorpay</span>
      </Badge>
    ),
  },
  apple_pay: {
    label: 'Apple Pay',
    ariaLabel: 'Apple Pay accepted',
    render: () => (
      <Badge className="!bg-black">
        <span className="text-white font-semibold">Pay</span>
      </Badge>
    ),
  },
  applepay: {
    label: 'Apple Pay',
    ariaLabel: 'Apple Pay accepted',
    render: () => (
      <Badge className="!bg-black">
        <span className="text-white font-semibold">Pay</span>
      </Badge>
    ),
  },
  google_pay: {
    label: 'Google Pay',
    ariaLabel: 'Google Pay accepted',
    render: () => (
      <Badge>
        <span className="text-[#4285f4]">G</span>
        <span className="text-[#ea4335]">Pay</span>
      </Badge>
    ),
  },
  gpay: {
    label: 'Google Pay',
    ariaLabel: 'Google Pay accepted',
    render: () => (
      <Badge>
        <span className="text-[#4285f4]">G</span>
        <span className="text-[#ea4335]">Pay</span>
      </Badge>
    ),
  },
  upi: {
    label: 'UPI',
    ariaLabel: 'UPI payments',
    render: () => (
      <Badge>
        <Smartphone className="w-3.5 h-3.5 mr-1 text-[#097939]" aria-hidden="true" />
        <span className="text-[#097939] font-extrabold">UPI</span>
      </Badge>
    ),
  },
  cod: {
    label: 'Cash on Delivery',
    ariaLabel: 'Cash on delivery available',
    render: () => (
      <Badge>
        <Banknote className="w-3.5 h-3.5 mr-1 text-emerald-600" aria-hidden="true" />
        <span className="text-emerald-700">COD</span>
      </Badge>
    ),
  },
  bank_transfer: {
    label: 'Bank Transfer',
    ariaLabel: 'Bank transfer accepted',
    render: () => (
      <Badge>
        <span className="text-gray-700 uppercase">Bank</span>
      </Badge>
    ),
  },
}

export default function PaymentMethodsStripBlock({ props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Secure Payments'),
  })
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const rawMethodsArray = Array.isArray(props.methods) && props.methods.length > 0
    ? props.methods
    : DEFAULT_PAYMENT_METHOD_KEYS
  const methods = isEditorCanvas
    ? visibleArrayEntries(rawMethodsArray, props, 'methods')
        .map(({ item }) => normalizePaymentMethodKey(item))
        .filter(Boolean)
    : readPaymentMethodKeys(props)

  return (
    <div className="py-6 px-4 text-center border-t border-gray-100" aria-label={title ?? undefined}>
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="p"
          className="text-xs text-gray-400 uppercase tracking-widest mb-3"
          placeholder="Section title"
        />
      )}
      <ul className="flex justify-center gap-2.5 flex-wrap list-none p-0 m-0">
        {methods.map((rawKey, index) => {
          const key = rawKey.toLowerCase().replace(/\s+/g, '_')
          const m = METHODS[key]
          if (!m) {
            return (
              <li key={`${rawKey}-${index}`} aria-label={`${paymentMethodLabel(rawKey)} accepted`}>
                <Badge>
                  <CreditCard className="w-3.5 h-3.5 mr-1 text-gray-500" aria-hidden="true" />
                  <span className="text-gray-600">{paymentMethodLabel(rawKey)}</span>
                </Badge>
              </li>
            )
          }
          return (
            <li key={`${rawKey}-${index}`} aria-label={m.ariaLabel}>
              {m.render()}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
