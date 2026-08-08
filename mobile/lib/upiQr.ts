/** Build a scannable UPI QR image URL (same approach as storefront). */
export function buildUpiQrImageUrl(
  upiId: string,
  amountRupees: number,
  businessName?: string | null,
): string {
  const params = new URLSearchParams({
    pa: upiId,
    am: Number(amountRupees || 0).toFixed(2),
    cu: 'INR',
  })
  if (businessName) params.set('pn', businessName.slice(0, 50))
  const payload = `upi://pay?${params.toString()}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`
}

export function resolveUpiQrSrc(opts: {
  qr_code_url?: string | null
  upi_id?: string | null
  amountRupees: number
  business_name?: string | null
}): string | null {
  if (opts.qr_code_url) return opts.qr_code_url
  if (opts.upi_id) {
    return buildUpiQrImageUrl(opts.upi_id, opts.amountRupees, opts.business_name)
  }
  return null
}
