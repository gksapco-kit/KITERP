/** Build a Google Maps embed iframe src from an address or custom URL */
export function resolveMapEmbedSrc(location?: string, customEmbedUrl?: string): string {
  const custom = customEmbedUrl?.trim()
  if (custom) {
    if (custom.startsWith('http')) return custom
    return `https://${custom}`
  }
  const query = location?.trim() || 'New York, NY'
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

export function buildDirectionsUrl(location?: string): string {
  const query = location?.trim() || 'New York, NY'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
