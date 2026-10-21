/** Vendor settings key: generate a GST e-invoice (IRN) when a tax invoice is created. */
export const AUTO_GENERATE_EINVOICE_KEY = 'auto_generate_einvoice'
export const EINVOICE_CREDENTIALS_KEY = 'einvoice'

export type EinvoiceCredentials = {
  client_id?: string
  client_secret?: string
  username?: string
  password?: string
  sandbox?: boolean
}

export function autoGenerateEinvoice(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(settings?.[AUTO_GENERATE_EINVOICE_KEY])
}

export function readEinvoiceCredentials(
  settings: Record<string, unknown> | null | undefined,
): EinvoiceCredentials {
  const raw = settings?.[EINVOICE_CREDENTIALS_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { sandbox: true }
  const creds = raw as Record<string, unknown>
  return {
    client_id: typeof creds.client_id === 'string' ? creds.client_id : '',
    client_secret: typeof creds.client_secret === 'string' ? creds.client_secret : '',
    username: typeof creds.username === 'string' ? creds.username : '',
    password: typeof creds.password === 'string' ? creds.password : '',
    sandbox: creds.sandbox !== false,
  }
}
