/**
 * Storefront vendor self-service signup routes.
 * Must NOT live under `/vendor/*` — production nginx proxies that prefix to vendor-web.
 */
export const VENDOR_SIGNUP_PATH = '/create-business'
export const VENDOR_VERIFY_EMAIL_PATH = '/create-business/verify-email'
