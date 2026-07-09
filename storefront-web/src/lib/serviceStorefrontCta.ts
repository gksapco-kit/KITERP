import type { DisplayFieldMap } from '@/lib/storefrontDisplayFields'

/** True when the service accepts quote requests and the storefront display toggle is on. */
export function serviceQuoteEnabled(
  allowQuoteRequest?: boolean,
  serviceDisplayFields?: DisplayFieldMap,
): boolean {
  return !!allowQuoteRequest && serviceDisplayFields?.quote_request !== false
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
