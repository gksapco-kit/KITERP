/** Starter-template testimonial rows — not real customer data. */
const TEMPLATE_TESTIMONIAL_NAMES = new Set([
  'Priya S.',
  'Arjun M.',
  'Sarah M.',
  'James L.',
  'Sarah J.',
  'Mike R.',
  'Sarah Johnson',
  'Michael Chen',
])

export function isTemplateTestimonial(entry: {
  name?: string
  role?: string
  quote?: string
}): boolean {
  const name = String(entry.name || '').trim()
  if (TEMPLATE_TESTIMONIAL_NAMES.has(name)) return true
  const quote = String(entry.quote || '').toLowerCase()
  const role = String(entry.role || '').toLowerCase()
  if (role === 'subscriber' && quote.includes('meal subscription')) return true
  if (quote.includes('meal subscription is a lifesaver')) return true
  return false
}

export function isLiveTestimonialsBound(props: Record<string, unknown>): boolean {
  const ds = props.data_source as { type?: string; auto?: boolean } | undefined
  return ds?.type === 'testimonials' || ds?.auto === true
}
