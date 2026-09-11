/** Vendor settings key: require email/SMS OTP to deactivate an active custom domain. */
export const REQUIRE_DOMAIN_DEACTIVATION_OTP_KEY = 'require_domain_deactivation_otp'

export function requireDomainDeactivationOtp(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(settings?.[REQUIRE_DOMAIN_DEACTIVATION_OTP_KEY])
}
