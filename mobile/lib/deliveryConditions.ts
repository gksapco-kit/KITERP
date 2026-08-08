/** Match storefront: missing / true → sign-in required; only explicit false allows guests. */
export function isSignInMandatory(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  const raw = settings?.delivery_conditions
  if (!raw || typeof raw !== 'object') return true
  return (raw as { sign_in_mandatory?: unknown }).sign_in_mandatory !== false
}
