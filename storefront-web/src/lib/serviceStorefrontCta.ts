import type { DisplayFieldMap } from '@/lib/storefrontDisplayFields'

/** True when the service accepts quote requests and the storefront display toggle is on. */
export function serviceQuoteEnabled(
  allowQuoteRequest?: boolean,
  serviceDisplayFields?: DisplayFieldMap,
): boolean {
  return !!allowQuoteRequest && serviceDisplayFields?.quote_request !== false
}

/** Customer-facing booking option label (Business Front Options → Booking). */
export function serviceBookingLabel(bookingLabel?: string | null): string {
  const label = (bookingLabel || '').trim()
  return label || 'Booking'
}

/** Customer-facing subscription option label. */
export function serviceSubscriptionLabel(subscriptionLabel?: string | null): string {
  const label = (subscriptionLabel || '').trim()
  return label || 'Subscription'
}

/** Primary subscribe CTA — verb form for default, otherwise the custom label. */
export function serviceSubscriptionCtaLabel(subscriptionLabel?: string | null): string {
  const label = serviceSubscriptionLabel(subscriptionLabel)
  return label === 'Subscription' ? 'Subscribe' : label
}

/** Tax footnote from service/product tax settings (null when not configured). */
export function subscriptionTaxNote(opts: {
  isTaxable?: boolean | null
  taxRate?: number | null
}): string | null {
  if (opts.isTaxable === false) return 'Non-taxable'
  if (opts.isTaxable !== true) return null
  if (opts.taxRate != null && opts.taxRate > 0) return `Includes GST @ ${opts.taxRate}%`
  return 'Taxable'
}

/** Billing footnote from interval + price type + UOM + tax settings. */
export function subscriptionBillingFootnote(opts: {
  interval?: string | null
  priceType?: string | null
  uom?: string | null
  isTaxable?: boolean | null
  taxRate?: number | null
}): string {
  const parts: string[] = []
  if (opts.priceType === 'per_unit' && opts.uom) {
    const uom = opts.uom.replace(/^per_/, '').replace(/_/g, ' ')
    parts.push(`per ${uom}`)
  } else if (opts.interval) {
    const label = opts.interval.replace(/_/g, ' ')
    parts.push(`Billed ${label}`)
  }
  const tax = subscriptionTaxNote(opts)
  if (tax) parts.push(tax)
  return parts.join(' · ') || 'Pricing as configured'
}

/** Customer-facing quote-request option label. */
export function serviceQuoteRequestLabel(quoteRequestLabel?: string | null): string {
  const label = (quoteRequestLabel || '').trim()
  return label || 'Quote Requests'
}

/** Primary book CTA on service detail — uses custom label when not the default. */
export function serviceBookingCtaLabel(bookingLabel?: string | null): string {
  const label = serviceBookingLabel(bookingLabel)
  return label === 'Booking' ? 'Book This Service' : label
}

/** Compact book CTA on service cards/lists. */
export function serviceBookingListCtaLabel(bookingLabel?: string | null): string {
  const label = serviceBookingLabel(bookingLabel)
  return label === 'Booking' ? 'Book' : label
}

/** Primary quote CTA — uses custom label when not the default. */
export function serviceQuoteCtaLabel(quoteRequestLabel?: string | null): string {
  const label = serviceQuoteRequestLabel(quoteRequestLabel)
  return label === 'Quote Requests' ? 'Request a Quote' : label
}

/** Whether to show a Book CTA on service cards/lists (hidden when quote mode is active). */
export function shouldShowServiceBookCta(
  opts: { allow_quote_request?: boolean; requires_booking?: boolean },
  serviceDisplayFields?: DisplayFieldMap,
): boolean {
  if (serviceQuoteEnabled(opts.allow_quote_request, serviceDisplayFields)) {
    return false
  }
  if (opts.requires_booking === false) return false
  return true
}
