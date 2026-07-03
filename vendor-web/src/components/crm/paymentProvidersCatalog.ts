export type PaymentProviderId =
  | 'razorpay'
  | 'stripe'
  | 'square'
  | 'paypal'
  | 'payu'
  | 'sepa_direct_debit'
  | 'wire_transfer'
  | 'demo'
  | 'adyen'
  | 'amazon_payment_services'
  | 'asiapay'
  | 'authorize_net'
  | 'buckaroo'
  | 'flutterwave'
  | 'mercado_pago'
  | 'mollie'
  | 'sips'

export type PaymentProviderDef = {
  id: PaymentProviderId
  label: string
  credentials: string[]
  settings: string[]
}

/** Checkout payment providers shown on CRM → Integrations (Odoo-style catalog). */
export const PAYMENT_PROVIDERS: PaymentProviderDef[] = [
  { id: 'razorpay', label: 'Razorpay', credentials: ['key_id', 'key_secret', 'webhook_secret'], settings: ['mode', 'checkout_config_id'] },
  { id: 'stripe', label: 'Stripe', credentials: ['publishable_key', 'secret_key', 'webhook_secret'], settings: ['mode'] },
  { id: 'square', label: 'Square', credentials: ['application_id', 'access_token', 'webhook_signature_key'], settings: ['mode', 'location_id'] },
  { id: 'paypal', label: 'PayPal', credentials: ['client_id', 'client_secret', 'webhook_id'], settings: ['mode'] },
  { id: 'payu', label: 'PayU', credentials: ['merchant_key', 'merchant_salt'], settings: ['mode'] },
  { id: 'sepa_direct_debit', label: 'SEPA Direct Debit', credentials: ['api_key', 'api_secret', 'webhook_secret'], settings: ['mode'] },
  { id: 'wire_transfer', label: 'Wire Transfer', credentials: ['account_name', 'account_number', 'bank_code'], settings: ['instructions'] },
  { id: 'demo', label: 'Demo', credentials: ['api_key'], settings: ['mode'] },
  { id: 'adyen', label: 'Adyen', credentials: ['api_key', 'client_key', 'webhook_secret'], settings: ['mode', 'merchant_account'] },
  { id: 'amazon_payment_services', label: 'Amazon Payment Services', credentials: ['access_code', 'merchant_identifier', 'sha_request_phrase'], settings: ['mode'] },
  { id: 'asiapay', label: 'Asiapay', credentials: ['merchant_id', 'secure_hash_secret'], settings: ['mode'] },
  { id: 'authorize_net', label: 'Authorize.net', credentials: ['api_login_id', 'transaction_key', 'signature_key'], settings: ['mode'] },
  { id: 'buckaroo', label: 'Buckaroo', credentials: ['website_key', 'secret_key'], settings: ['mode'] },
  { id: 'flutterwave', label: 'Flutterwave', credentials: ['public_key', 'secret_key', 'webhook_secret'], settings: ['mode'] },
  { id: 'mercado_pago', label: 'Mercado Pago', credentials: ['public_key', 'access_token', 'webhook_secret'], settings: ['mode'] },
  { id: 'mollie', label: 'Mollie', credentials: ['api_key', 'webhook_secret'], settings: ['mode'] },
  { id: 'sips', label: 'Sips', credentials: ['merchant_id', 'secret_key'], settings: ['mode'] },
]

export const PAYMENT_PROVIDER_IDS = new Set(PAYMENT_PROVIDERS.map(p => p.id))

export const PAYMENT_SETTING_HINTS: Record<string, Record<string, string>> = {
  razorpay: { mode: 'test or live', checkout_config_id: 'optional — from Razorpay Dashboard → Payment Configuration' },
  stripe: { mode: 'test or live' },
  square: { mode: 'sandbox or live', location_id: 'Optional Square location ID for in-person / online checkout' },
  paypal: { mode: 'sandbox or live' },
  payu: { mode: 'test or live' },
  sepa_direct_debit: { mode: 'test or live' },
  wire_transfer: { instructions: 'Shown to customers after they choose bank transfer at checkout' },
  demo: { mode: 'sandbox only — no real charges' },
  adyen: { mode: 'test or live', merchant_account: 'Adyen merchant account code' },
  amazon_payment_services: { mode: 'sandbox or live' },
  asiapay: { mode: 'test or live' },
  authorize_net: { mode: 'sandbox or live' },
  buckaroo: { mode: 'test or live' },
  flutterwave: { mode: 'test or live' },
  mercado_pago: { mode: 'sandbox or live' },
  mollie: { mode: 'test or live' },
  sips: { mode: 'test or live' },
}
