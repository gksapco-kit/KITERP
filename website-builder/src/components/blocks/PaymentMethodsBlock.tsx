import { Lock, ShieldCheck } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import { PAYMENT_METHODS_DEFAULTS } from '../../lib/paymentMethodsDefaults'
import type { Block, PaymentMethodItem } from '../../types/builder'

interface PaymentMethodsBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function PaymentBadge({ method }: { method: PaymentMethodItem }) {
  const bg = method.brandColor ?? '#4f46e5'
  const color = method.textColor ?? '#ffffff'
  const isLight = bg.toLowerCase() === '#ffffff' || bg.toLowerCase() === '#fff'

  return (
    <span
      className={`inline-flex min-h-[2rem] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide shadow-sm ${
        isLight ? 'border border-gray-200' : ''
      }`}
      style={{ backgroundColor: bg, color }}
      title={method.name}
    >
      {method.name}
    </span>
  )
}

function SecureRow({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {text}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        PCI compliant
      </span>
    </div>
  )
}

export function PaymentMethodsBlock({ block, layoutStyle }: PaymentMethodsBlockProps) {
  const { props, styles } = block
  const layout = props.paymentMethodsLayout ?? PAYMENT_METHODS_DEFAULTS.paymentMethodsLayout
  const methods = (props.paymentMethods ?? []).filter((m) => m.enabled !== false)
  const showSecure = props.showSecureBadge !== false
  const secureText = props.secureText ?? PAYMENT_METHODS_DEFAULTS.secureText
  const title = props.text?.trim()
  const subtitle = props.subtitle?.trim()

  const badges = (
    <div
      className={
        layout === 'compact'
          ? 'flex flex-wrap items-center justify-center gap-2'
          : 'flex flex-wrap items-center justify-center gap-2.5 sm:gap-3'
      }
    >
      {methods.length === 0 ? (
        <p className="text-sm text-gray-400">Add payment methods in the properties panel</p>
      ) : (
        methods.map((m) => <PaymentBadge key={m.id ?? m.name} method={m} />)
      )}
    </div>
  )

  if (layout === 'compact') {
    return (
      <section style={layoutStyle} className="w-full">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {badges}
          {showSecure && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Lock className="h-3 w-3" aria-hidden />
              {secureText}
            </span>
          )}
        </div>
      </section>
    )
  }

  if (layout === 'inline') {
    return (
      <section style={layoutStyle} className="w-full">
        {(title || subtitle) && (
          <SectionHeading title={title} subtitle={subtitle} styles={styles} className="mb-4 text-center" />
        )}
        <div className="flex flex-col items-center gap-4">
          {badges}
          {showSecure && <SecureRow text={secureText} />}
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200/80 bg-gradient-to-b from-gray-50/80 to-white p-6 shadow-sm dark:border-gray-700/80 dark:from-gray-900/50 dark:to-gray-900 sm:p-8">
        {(title || subtitle) && (
          <SectionHeading title={title} subtitle={subtitle} styles={styles} className="mb-6 text-center" />
        )}
        {!title && !subtitle && (
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            Secure payments
          </p>
        )}
        {badges}
        {showSecure && (
          <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
            <SecureRow text={secureText} />
          </div>
        )}
      </div>
    </section>
  )
}
