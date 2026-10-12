import { describe, expect, it } from 'vitest'
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/invoiceTemplates'
import { buildPosOverrides, previewPosSettings, type PosModalValues } from '@/lib/posOverrides'

// What the POS page passes to the modal as `invSettings`: defaults + the vendor's saved invoice settings.
const base = {
  ...DEFAULT_INVOICE_SETTINGS,
  terms_and_conditions: 'Goods once sold will not be taken back',
  bank_name: 'HDFC',
  signature_url: '/uploads/vendor-signatures/' + 'a'.repeat(32) + '.png',
}

function valuesFrom(settings: Record<string, any>, over: Partial<PosModalValues> = {}): PosModalValues {
  return {
    template: settings.template || 'classic',
    paper_size: settings.paper_size || 'A4',
    color: settings.color || '#2563eb',
    show_logo: settings.show_logo !== false,
    show_hsn: settings.show_hsn !== false,
    show_tax_breakdown: settings.show_tax_breakdown !== false,
    show_notes: settings.show_notes !== false,
    show_signature: settings.show_signature !== false,
    ...over,
  }
}

describe('buildPosOverrides', () => {
  it('saves nothing when no control differs from the invoice settings', () => {
    expect(buildPosOverrides(base, {}, valuesFrom(base))).toEqual({})
  })

  it('saves only the controls that differ', () => {
    const out = buildPosOverrides(base, {}, valuesFrom(base, { paper_size: '3inch', show_hsn: false }))
    expect(out).toEqual({ paper_size: '3inch', show_hsn: false })
  })

  it('never copies unrelated invoice settings (terms, bank, signature)', () => {
    const out = buildPosOverrides(base, {}, valuesFrom(base, { color: '#ff0000' })) as Record<string, unknown>
    expect(Object.keys(out)).toEqual(['color'])
    expect(out.terms_and_conditions).toBeUndefined()
    expect(out.bank_name).toBeUndefined()
    expect(out.signature_url).toBeUndefined()
  })

  it('keeps overrides the modal has no control for', () => {
    const existing = { template_pages_html: '<p>custom</p>', show_qr: false, footer_text: 'Thanks' } as any
    const out = buildPosOverrides(base, existing, valuesFrom(base, { paper_size: '2inch' })) as any
    expect(out.template_pages_html).toBe('<p>custom</p>')
    expect(out.show_qr).toBe(false)
    expect(out.footer_text).toBe('Thanks')
    expect(out.paper_size).toBe('2inch')
  })

  it('drops an existing override once the control matches the invoice setting again', () => {
    const existing = { paper_size: '3inch', show_logo: false, footer_text: 'Hi' } as any
    const out = buildPosOverrides(base, existing, valuesFrom(base)) as any
    expect(out).toEqual({ footer_text: 'Hi' })
  })

  it('treats an unset toggle as on and compares against that', () => {
    const noFlags = { ...base } as any
    delete noFlags.show_logo
    expect(buildPosOverrides(noFlags, {}, valuesFrom(noFlags))).toEqual({})
    expect(buildPosOverrides(noFlags, {}, valuesFrom(noFlags, { show_logo: false }))).toEqual({ show_logo: false })
  })

  it('does not mutate its inputs', () => {
    const existing = Object.freeze({ footer_text: 'Hi' }) as any
    expect(() => buildPosOverrides(base, existing, valuesFrom(base, { color: '#000000' }))).not.toThrow()
    expect(existing).toEqual({ footer_text: 'Hi' })
  })

  it('later invoice-setting edits still reach POS after saving overrides', () => {
    const saved = buildPosOverrides(base, {}, valuesFrom(base, { paper_size: '3inch' }))
    const updatedBase = { ...base, terms_and_conditions: 'New terms', bank_name: 'ICICI' }
    const rendered = { ...updatedBase, ...saved } as any
    expect(rendered.terms_and_conditions).toBe('New terms')
    expect(rendered.bank_name).toBe('ICICI')
    expect(rendered.paper_size).toBe('3inch')
  })
})

describe('previewPosSettings', () => {
  it('layers invoice settings, existing overrides, then live control values', () => {
    const existing = { footer_text: 'Hi', color: '#111111' } as any
    const out = previewPosSettings(base, existing, valuesFrom(base, { color: '#222222' })) as any
    expect(out.terms_and_conditions).toBe(base.terms_and_conditions)
    expect(out.footer_text).toBe('Hi')
    expect(out.color).toBe('#222222')
  })
})
