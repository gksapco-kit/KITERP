/** Plan-level feature flags from VendorPlan.features (JSONB). */

export function planAllowsRestaurant(features: Record<string, unknown> | null | undefined): boolean {
  if (!features || typeof features !== 'object') return true
  return features.restaurant !== false
}

export function planAllowsPos(features: Record<string, unknown> | null | undefined): boolean {
  if (!features || typeof features !== 'object') return true
  return features.pos !== false
}
