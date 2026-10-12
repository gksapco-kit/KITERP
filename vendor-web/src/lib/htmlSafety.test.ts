import { describe, expect, it } from 'vitest'
import { escapeDocData, escapeHtml, stripActiveContent, withNoScriptCsp } from '@/lib/htmlSafety'
import { INVOICE_TEMPLATE_IDS, generateInvoiceHtml, type InvoiceSettings } from '@/lib/invoiceTemplates'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

/** Everything in a document that can run code or pull in active content. */
function activeContent(html: string): string[] {
  const doc = parse(html)
  const found: string[] = []
  doc.querySelectorAll('script, iframe, frame, object, embed, applet, base, link, form, foreignObject').forEach((el) =>
    found.push(`<${el.tagName.toLowerCase()}>`),
  )
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc') found.push(`${el.tagName.toLowerCase()}[${name}]`)
      if (['href', 'src', 'xlink:href', 'action'].includes(name) && /^\s*(javascript|vbscript):/i.test(attr.value)) {
        found.push(`${el.tagName.toLowerCase()}[${name}=${attr.value}]`)
      }
    }
  })
  return found
}

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })
  it('handles non-strings', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(42)).toBe('42')
  })
})

describe('escapeDocData', () => {
  it('escapes every string, deeply, without touching numbers, booleans or null', () => {
    const input = { a: '<b>', n: 5, ok: true, nil: null, nested: { list: ['&', { x: '"' }] } }
    expect(escapeDocData(input)).toEqual({
      a: '&lt;b&gt;', n: 5, ok: true, nil: null, nested: { list: ['&amp;', { x: '&quot;' }] },
    })
  })
  it('does not mutate its input', () => {
    const input = { a: '<b>', items: [{ name: '<i>' }] }
    escapeDocData(input)
    expect(input).toEqual({ a: '<b>', items: [{ name: '<i>' }] })
  })
  it('keeps deliberate HTML in template_pages_html (the server sanitises that one)', () => {
    const out = escapeDocData({ template_pages_html: '<div class="page">x</div>', notes: '<div>' })
    expect(out.template_pages_html).toBe('<div class="page">x</div>')
    expect(out.notes).toBe('&lt;div&gt;')
  })
  it('is bounded on very deep input', () => {
    let deep: Record<string, unknown> = { v: '<x>' }
    for (let i = 0; i < 50; i++) deep = { child: deep }
    expect(() => escapeDocData(deep)).not.toThrow()
  })
})

describe('withNoScriptCsp', () => {
  const policy = (html: string) => parse(html).head.querySelector('meta[http-equiv="Content-Security-Policy"]')

  it('adds a script-blocking policy to the head, after the doctype', () => {
    const out = withNoScriptCsp('<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>')
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(policy(out)?.getAttribute('content')).toContain("script-src 'none'")
  })
  it('works for fragments and documents without a doctype', () => {
    expect(policy(withNoScriptCsp('<div>hi</div>'))).not.toBeNull()
    expect(policy(withNoScriptCsp('<html><body>hi</body></html>'))).not.toBeNull()
  })
  it('is idempotent and tolerates empty input', () => {
    const once = withNoScriptCsp('<p>x</p>')
    expect(withNoScriptCsp(once)).toBe(once)
    expect(withNoScriptCsp('')).toBe('')
  })
})

describe('stripActiveContent', () => {
  const html = (body: string, head = '') => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`

  it.each([
    ['script tag', '<script>alert(1)</script><p>keep</p>'],
    ['img onerror', '<img src="x" onerror="alert(1)">'],
    ['svg onload', '<svg onload="alert(1)"><circle/></svg>'],
    ['body-ish handler', '<div onmouseover="alert(1)">x</div>'],
    ['javascript href', '<a href="javascript:alert(1)">x</a>'],
    ['javascript href, mixed case + whitespace', '<a href="  JaVa\nScRiPt:alert(1)">x</a>'],
    ['javascript href via entities', '<a href="jav&#x61;script&colon;alert(1)">x</a>'],
    ['vbscript href', '<a href="vbscript:msgbox(1)">x</a>'],
    ['data:text/html src', '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>'],
    ['data:text/html href', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'],
    ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    ['object', '<object data="evil.swf"></object>'],
    ['embed', '<embed src="evil.swf">'],
    ['form action', '<form action="https://evil.example"><input name="a"></form>'],
    ['svg foreignObject', '<svg><foreignObject><div onclick="x()">x</div></foreignObject></svg>'],
    ['formaction', '<button formaction="javascript:alert(1)">x</button>'],
  ])('removes %s', (_name, body) => {
    const out = stripActiveContent(html(body))
    expect(activeContent(out)).toEqual([])
  })

  it('removes base, external links and refresh redirects from the head', () => {
    const out = stripActiveContent(html('<p>x</p>',
      '<base href="https://evil.example/"><link rel="stylesheet" href="https://evil.example/x.css">' +
      '<meta http-equiv="refresh" content="0;url=https://evil.example">'))
    const doc = parse(out)
    expect(doc.querySelector('base, link, meta[http-equiv]')).toBeNull()
  })

  it('keeps layout, styles, inline styles, tables, images and ordinary links', () => {
    const input = html(
      '<div class="page" style="color:#123"><table><tr><td>₹1,000.00</td></tr></table>' +
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="logo"><a href="https://ok.example/x?a=1&amp;b=2">ok</a></div>',
      '<title>Invoice</title><style>.page > td{color:red}</style>',
    )
    const doc = parse(stripActiveContent(input))
    expect(doc.querySelector('style')?.textContent).toContain('.page > td{color:red}')
    expect(doc.querySelector('.page')?.getAttribute('style')).toBe('color:#123')
    expect(doc.querySelector('td')?.textContent).toBe('₹1,000.00')
    expect(doc.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png/)
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://ok.example/x?a=1&b=2')
    expect(doc.querySelector('title')?.textContent).toBe('Invoice')
  })

  it('is idempotent', () => {
    const once = stripActiveContent(html('<img src=x onerror=alert(1)><p>keep</p>'))
    expect(stripActiveContent(once)).toBe(once)
  })
})

// ── The real document generator, with hostile data in every field ──────────────────────────────

const EVIL = '<img src=x onerror="window.__pwned=1">'
const EVIL_SCRIPT = '<script>window.__pwned=2</script>'

function hostileInvoice() {
  const evil = (label: string) => `${label} ${EVIL}${EVIL_SCRIPT}<a href="javascript:window.__pwned=3">click</a>`
  return {
    invoice_number: 'INV-2026-0001', invoice_type: 'invoice', document_type: 'tax_invoice', is_gst: true,
    created_at: '2026-10-12T10:00:00', due_date: '2026-10-27', financial_year: '2026-27',
    vendor_name: evil('Vendor & Sons'), vendor_gstin: '29ABCDE1234F1Z5', vendor_pan: 'ABCDE1234F',
    vendor_address: { street: evil('street'), city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' },
    customer_name: evil('Ravi & Co'), customer_email: `a${EVIL}@example.com`, customer_phone: evil('+91'),
    customer_gstin: evil('27AAAAA0000A1Z5'),
    billing_address: { street: evil('bill'), city: 'Mumbai' }, shipping_address: { street: evil('ship'), city: 'Pune' },
    place_of_supply: evil('Maharashtra'), payment_terms: evil('Net 15'),
    booking_number: evil('BK-1'), order_number: evil('ORD-1'),
    notes: evil('notes'), terms_and_conditions: evil('terms'),
    extra_fields: [{ label: evil('label'), type: 'text', value: evil('value') }],
    items: [
      { name: evil('Widget'), description: evil('desc'), hsn_sac: evil('8479'), qty: 1.5, rate: 1000, discount: 50,
        cgst_amt: 85.5, sgst_amt: 85.5, igst_amt: 0, total: 1621, image_url: `x" onerror="window.__pwned=4` },
    ],
    subtotal: 1500, discount_amount: 25, taxable_amount: 1425, cgst_amount: 128.25, sgst_amount: 128.25,
    igst_amount: 0, total_tax: 256.5, round_off: 0.4, total: 1681.9, amount_paid: 500, balance_due: 1181.9,
    vendor_logo_url: `x" onerror="window.__pwned=5`,
  }
}

function hostileSettings(over: Partial<InvoiceSettings> = {}): Partial<InvoiceSettings> {
  const evil = (label: string) => `${label} ${EVIL}${EVIL_SCRIPT}`
  return {
    show_bank_details: true, show_signature: true, show_notes: true, show_terms: true, show_qr_code: true,
    show_url: true, show_amount_in_words: true, show_shipping_address: true, show_discount: true,
    show_taxable_amount: true, show_item_numbers: true, show_product_images: true,
    bank_name: evil('Bank'), account_number: evil('123'), ifsc_code: evil('IFSC'),
    account_holder_name: evil('Holder'), upi_id: evil('upi'), signatory_name: evil('Signer'),
    default_notes: evil('dnotes'), default_terms: evil('dterms'), default_payment_terms: evil('dpay'),
    qr_code_label: evil('qr'), watermark: evil('mark'), website_url: `https://x.example/"onmouseover="window.__pwned=6`,
    tax_label: evil('Tax'), cgst_label: evil('CGST'), sgst_label: evil('SGST'), igst_label: evil('IGST'),
    discount_label: evil('Disc'),
    logo_url: `x" onerror="window.__pwned=7`, signature_url: `x" onerror="window.__pwned=8`,
    qr_code_url: `x" onerror="window.__pwned=9`,
    ...over,
  }
}

describe('generateInvoiceHtml escapes customer- and vendor-typed data', () => {
  const variants: Array<[string, Partial<InvoiceSettings>]> = [
    ...INVOICE_TEMPLATE_IDS.map((id): [string, Partial<InvoiceSettings>] => [`template ${id}`, { template: id }]),
    ['thermal 3 inch', { paper_size: '3inch' }],
    ['thermal 2 inch', { paper_size: '2inch' }],
  ]

  it.each(variants)('%s: no markup, script, handler or javascript: URL gets through', (_name, over) => {
    const html = generateInvoiceHtml(hostileInvoice(), hostileSettings(over), '')
    expect(activeContent(html)).toEqual([])
    const doc = parse(html)
    expect(doc.querySelector('img[src="x"]')).toBeNull()                      // no injected <img>
    expect(doc.querySelector('a[href^="javascript"]')).toBeNull()
  })

  it('shows the hostile text literally, so nothing is silently dropped', () => {
    const doc = parse(generateInvoiceHtml(hostileInvoice(), hostileSettings(), ''))
    const text = doc.body.textContent ?? ''
    expect(text).toContain(EVIL)                                              // customer_name etc. are visible as text
    expect(text).toContain(EVIL_SCRIPT)
  })

  it('does not double-escape ordinary text', () => {
    const html = generateInvoiceHtml(
      { ...hostileInvoice(), vendor_name: 'Acme & Sons', customer_name: "O'Brien <Traders>", notes: 'a & b' },
      hostileSettings(),
      '',
    )
    expect(html).not.toContain('&amp;amp;')
    const text = parse(html).body.textContent ?? ''
    expect(text).toContain('Acme & Sons')
    expect(text).toContain("O'Brien <Traders>")
    expect(text).toContain('a & b')
  })

  it('leaves numbers, money and layout intact', () => {
    const text = parse(generateInvoiceHtml(hostileInvoice(), hostileSettings(), '')).body.textContent ?? ''
    expect(text).toContain('1,681.90')
    expect(text).toMatch(/TAX INVOICE/i)
  })

  it('keeps stored template pages as deliberate HTML', () => {
    const html = generateInvoiceHtml(hostileInvoice(), { ...hostileSettings(), template_pages_html: '<div class="page" data-x="1">custom</div>' }, '')
    expect(html).not.toContain('&lt;div class=&quot;page&quot;')
  })

  it('does not mutate the caller\'s data', () => {
    const inv = hostileInvoice()
    const before = JSON.stringify(inv)
    generateInvoiceHtml(inv, hostileSettings(), '')
    expect(JSON.stringify(inv)).toBe(before)
  })
})
