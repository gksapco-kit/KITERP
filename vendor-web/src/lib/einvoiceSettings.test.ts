import { describe, expect, it } from 'vitest'
import { autoGenerateEinvoice, readEinvoiceCredentials } from './einvoiceSettings'
import { generateInvoiceHtml, DEFAULT_INVOICE_SETTINGS } from './invoiceTemplates'

describe('e-invoice storefront setting', () => {
  it('stays off unless the vendor turns it on', () => {
    expect(autoGenerateEinvoice(undefined)).toBe(false)
    expect(autoGenerateEinvoice({})).toBe(false)
    expect(autoGenerateEinvoice({ auto_generate_einvoice: true })).toBe(true)
  })

  it('reads sandbox credentials from vendor settings', () => {
    const creds = readEinvoiceCredentials({
      einvoice: { client_id: 'abc', username: 'gstuser', sandbox: false },
    })
    expect(creds.client_id).toBe('abc')
    expect(creds.username).toBe('gstuser')
    expect(creds.sandbox).toBe(false)
  })
})

describe('invoice print includes IRN', () => {
  it('prints the IRN on the invoice when an e-invoice exists', () => {
    const html = generateInvoiceHtml(
      {
        invoice_number: 'INV-1',
        invoice_type: 'invoice',
        customer_name: 'Buyer',
        vendor_name: 'Seller',
        total: 118,
        items: [{ name: 'Item', qty: 1, rate: 100, total: 118 }],
        einvoice_irn: 'IRN-TEST-123',
        einvoice_ack_no: 'ACK-9',
      },
      DEFAULT_INVOICE_SETTINGS,
      '',
    )
    expect(html).toContain('IRN-TEST-123')
    expect(html).toContain('ACK-9')
    expect(html).toContain('e-Invoice')
  })
})
