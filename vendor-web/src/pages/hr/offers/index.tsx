import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Plus, Send, ExternalLink, Trash2, FileText, Settings2, Loader2, Eye, LayoutTemplate } from 'lucide-react'
import {
  useHROffers, useCreateHROffer, useDeleteHROffer, useSendHROffer,
  useHRDepartments, useHRDesignations, useHROfferTemplates, useStores,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { OfferLetter, OfferLetterTemplate } from '@/types'
import type { OfferLayoutId, OfferWatermarkStyle, LogoShape } from '@/lib/offerLayouts'
import {
  OFFER_LAYOUTS, DEFAULT_OFFER_BODY, buildOfferPreviewHtml,
  findBestOfferTemplate, layoutLabel,
} from '@/lib/offerLayouts'
import { HtmlRichEditor, type HtmlRichEditorHandle } from '@/components/hr/HtmlRichEditor'
import { OfferLetterPreviewFrame } from '@/components/hr/OfferLetterPreviewFrame'

import { askConfirm } from '@/components/common/ConfirmProvider'

const denseFieldClass =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const denseLabelClass = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'

// Opens the offer HTML in a new tab using an authenticated API call + Blob URL
function useOpenOfferPreview() {
  const [loading, setLoading] = useState<string | null>(null)
  async function open(id: string) {
    setLoading(id)
    try {
      const html = await vendorApi.hrGetOfferHtml(id)
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const win  = window.open(url, '_blank')
      // revoke after the new tab has had time to load
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      if (!win) alert('Please allow pop-ups to preview offer letters.')
    } finally {
      setLoading(null)
    }
  }
  return { open, loading }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  expired:  { label: 'Expired',  color: 'bg-orange-100 text-orange-700' },
}

// ── Template label helper ─────────────────────────────────────────────────────
function tplLabel(t: OfferLetterTemplate) {
  const parts = [t.name]
  if ((t.designation as any)?.name) parts.push((t.designation as any).name)
  if ((t.department as any)?.name)  parts.push((t.department as any).name)
  if ((t.store as any)?.name)       parts.push((t.store as any).name)
  return parts.join(' · ') + (t.is_default ? ' ⭐' : '')
}

function resolveOriginPath(url: string) {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`
}

// ── New Offer Modal ───────────────────────────────────────────────────────────
function CreateOfferModal({
  departments, designations, onClose,
}: {
  departments: any[]; designations: any[]; onClose: () => void
}) {
  const create    = useCreateHROffer()
  const navigate  = useNavigate()
  const editorRef = useRef<HtmlRichEditorHandle>(null)
  const { data: vendor } = useQuery({ queryKey: ['myVendor'], queryFn: vendorApi.getMyVendor })
  const vendorName = vendor?.business_name || 'Your Company'

  const [form, setForm] = useState({
    candidate_name:  '',
    candidate_email: '',
    candidate_phone: '',
    designation_id:  '',
    department_id:   '',
    store_id:        '',
    offered_ctc:     '',
    offered_date:    new Date().toISOString().slice(0, 10),
    joining_date:    '',
    expiry_date:     '',
    notes:           '',
    template_id:     '',
    layout:          'standard' as OfferLayoutId,
    body_html:       DEFAULT_OFFER_BODY,
  })
  const [showPreview, setShowPreview] = useState(false)
  const [step, setStep] = useState<'details' | 'edit'>('details')

  const { data: storeData }     = useStores({ limit: 100 })
  const stores: any[]           = (storeData as any)?.stores ?? storeData ?? []

  const scopeParams = useMemo(() => ({
    designation_id: form.designation_id || undefined,
    department_id:  form.department_id  || undefined,
    store_id:       form.store_id       || undefined,
  }), [form.designation_id, form.department_id, form.store_id])

  const { data: templates = [] } = useHROfferTemplates(scopeParams)
  const bestTemplate = useMemo(
    () => findBestOfferTemplate(templates, scopeParams),
    [templates, scopeParams],
  )

  const activeTemplate = useMemo(() => {
    if (form.template_id) return templates.find(t => t.id === form.template_id) ?? null
    return bestTemplate
  }, [form.template_id, templates, bestTemplate])

  // Load template content when template selection changes
  useEffect(() => {
    if (!activeTemplate) return
    if (form.template_id || bestTemplate?.id === activeTemplate.id) {
      setForm(f => ({
        ...f,
        body_html: activeTemplate.body_html,
        layout: (activeTemplate.layout || 'standard') as OfferLayoutId,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate?.id])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const fmtDate = (d: string) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  const mergeValues = useMemo(() => ({
    candidate_name: form.candidate_name || 'Candidate',
    candidate_email: form.candidate_email || '',
    candidate_phone: form.candidate_phone || '',
    designation: designations.find((d: any) => d.id === form.designation_id)?.name || '',
    department: departments.find((d: any) => d.id === form.department_id)?.name || '',
    store: stores.find((s: any) => s.id === form.store_id)?.name || '',
    offered_ctc: form.offered_ctc ? `Rs.${Number(form.offered_ctc).toLocaleString('en-IN')}` : 'As discussed',
    offered_date: fmtDate(form.offered_date),
    joining_date: fmtDate(form.joining_date) || 'TBD',
    expiry_date: fmtDate(form.expiry_date) || 'N/A',
    today: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
  }), [form, designations, departments, stores])

  const previewHtml = useMemo(() => {
    const logoUrl = resolveOriginPath(activeTemplate?.logo_url || vendor?.logo_url || '')
    return buildOfferPreviewHtml(
      form.body_html,
      form.layout,
      vendorName,
      mergeValues,
      activeTemplate ? {
        enabled: activeTemplate.watermark_enabled ?? false,
        text: activeTemplate.watermark_text || vendorName,
        opacity: parseFloat(activeTemplate.watermark_opacity || '0.12') || 0.12,
        style: (activeTemplate.watermark_style || 'diagonal_text') as OfferWatermarkStyle,
      } : undefined,
      {
        url: logoUrl || undefined,
        show: activeTemplate?.show_logo ?? true,
        shape: (activeTemplate?.logo_shape || 'rounded') as LogoShape,
      },
    )
  }, [form.body_html, form.layout, vendorName, mergeValues, activeTemplate, vendor?.logo_url])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const chosenTemplateId = form.template_id || bestTemplate?.id || undefined
    await create.mutateAsync({
      candidate_name:  form.candidate_name,
      candidate_email: form.candidate_email || undefined,
      candidate_phone: form.candidate_phone || undefined,
      designation_id:  form.designation_id  || undefined,
      department_id:   form.department_id   || undefined,
      store_id:        form.store_id        || undefined,
      offered_ctc:     form.offered_ctc ? parseFloat(form.offered_ctc) : undefined,
      offered_date:    form.offered_date    || undefined,
      joining_date:    form.joining_date    || undefined,
      expiry_date:     form.expiry_date     || undefined,
      notes:           form.notes           || undefined,
      template_id:     chosenTemplateId,
      layout:          form.layout,
      template_content: previewHtml,
    })
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className={cn(
        'max-h-[calc(100dvh-1.5rem)] !rounded-lg overflow-hidden',
        showPreview && step === 'edit' ? 'max-w-5xl' : 'max-w-lg',
      )}>
        <ModalHeader
          title={
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-none text-foreground">New Offer Letter</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {step === 'details' ? 'Step 1 — Candidate & offer details' : 'Step 2 — Edit letter content & preview'}
              </p>
            </div>
          }
          onClose={onClose}
          className="border-0 px-4 py-2.5"
        />
        {step === 'edit' && (
          <div className="flex shrink-0 justify-end px-4 pb-1">
            <button type="button" onClick={() => setShowPreview(v => !v)}
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] ${showPreview ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-border hover:bg-muted'}`}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
            {step === 'details' ? (
              <>
                <div>
                  <div className="mb-0.5 flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">Template</label>
                    <button type="button" onClick={() => navigate('/hr/offers/templates')}
                      className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
                      <Settings2 className="h-3 w-3" /> Manage templates
                    </button>
                  </div>
                  <Select
                    value={form.template_id}
                    onChange={v => set('template_id', v)}
                    className={denseFieldClass}
                    options={[
                      {
                        value: '',
                        label: bestTemplate ? `Auto: ${tplLabel(bestTemplate)}` : '— System default —',
                      },
                      ...templates.map((t: OfferLetterTemplate) => ({ value: t.id, label: tplLabel(t) })),
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className={denseLabelClass} required>Candidate Name</Label>
                    <input required className={denseFieldClass}
                      value={form.candidate_name} onChange={e => set('candidate_name', e.target.value)} />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Email</Label>
                    <input type="email" className={denseFieldClass}
                      value={form.candidate_email} onChange={e => set('candidate_email', e.target.value)} />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Phone</Label>
                    <PhoneInput compact compactCountry value={form.candidate_phone} onChange={v => set('candidate_phone', v)} defaultCountryIso="IN" />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div>
                      <Label className={denseLabelClass}>Designation</Label>
                      <Select
                        className={denseFieldClass}
                        value={form.designation_id}
                        onChange={v => set('designation_id', v)}
                        options={[
                          { value: '', label: '— None —' },
                          ...designations.map((d: any) => ({ value: d.id, label: d.name })),
                        ]}
                      />
                    </div>
                    <div>
                      <Label className={denseLabelClass}>Department</Label>
                      <Select
                        className={denseFieldClass}
                        value={form.department_id}
                        onChange={v => set('department_id', v)}
                        options={[
                          { value: '', label: '— None —' },
                          ...departments.map((d: any) => ({ value: d.id, label: d.name })),
                        ]}
                      />
                    </div>
                    <div>
                      <Label className={denseLabelClass}>Store / Branch</Label>
                      <Select
                        className={denseFieldClass}
                        value={form.store_id}
                        onChange={v => set('store_id', v)}
                        options={[
                          { value: '', label: '— None —' },
                          ...stores.map((s: any) => ({ value: s.id, label: s.name })),
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className={denseLabelClass}>CTC (Annual ₹)</Label>
                    <input type="number" min={0} className={denseFieldClass}
                      value={form.offered_ctc} onChange={e => set('offered_ctc', e.target.value)} />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Offer Date</Label>
                    <input type="date" className={denseFieldClass}
                      value={form.offered_date} onChange={e => set('offered_date', e.target.value)} />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Joining Date</Label>
                    <input type="date" className={denseFieldClass}
                      value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Offer Expiry</Label>
                    <input type="date" className={denseFieldClass}
                      value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <div className={`grid gap-3 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
                <div className="space-y-2">
                  <div>
                    <label className={cn(denseLabelClass, 'flex items-center gap-1')}>
                      <LayoutTemplate className="h-3.5 w-3.5" /> Layout
                    </label>
                    <Select
                      value={form.layout}
                      onChange={v => set('layout', v)}
                      className={denseFieldClass}
                      options={OFFER_LAYOUTS.map(l => ({ value: l.id, label: l.label }))}
                    />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{layoutLabel(form.layout)}</p>
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Letter Content</Label>
                    <HtmlRichEditor
                      ref={editorRef}
                      editorKey={activeTemplate?.id ?? 'offer-new'}
                      value={form.body_html}
                      onChange={v => set('body_html', v)}
                      className="min-h-[220px]"
                    />
                  </div>
                  <div>
                    <Label className={denseLabelClass}>Notes (internal)</Label>
                    <textarea className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" rows={2}
                      value={form.notes} onChange={e => set('notes', e.target.value)} />
                  </div>
                </div>
                {showPreview && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase text-muted-foreground">Preview with candidate data</p>
                    <OfferLetterPreviewFrame html={previewHtml} title="Offer preview" />
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter className={cn('border-0 px-4 py-2.5', step === 'edit' && 'justify-between')}>
            {step === 'details' ? (
              <>
                <button type="button" onClick={onClose} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
                <button type="button" disabled={!form.candidate_name}
                  onClick={() => { setStep('edit'); setShowPreview(true) }}
                  className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  Next — Edit Letter
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep('details')} className="h-8 rounded-md border border-border px-3 text-sm">Back</button>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
                  <button type="submit" disabled={create.isPending}
                    className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                    {create.isPending ? 'Creating…' : 'Create Draft'}
                  </button>
                </div>
              </>
            )}
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Offers Page ───────────────────────────────────────────────────────────────
export default function OffersPage() {
  const navigate = useNavigate()
  const { data: offers = [], isLoading } = useHROffers()
  const { data: departments = [] }       = useHRDepartments()
  const { data: designations = [] }      = useHRDesignations()
  const deleteOffer  = useDeleteHROffer()
  const sendOffer    = useSendHROffer()
  const preview      = useOpenOfferPreview()
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offer Letters</h1>
          <p className="text-sm text-gray-500 mt-1">{(offers as OfferLetter[]).length} total offers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/hr/offers/templates')}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-600">
            <Settings2 className="w-4 h-4" /> Templates
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> New Offer
          </button>
        </div>
      </div>

      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (offers as OfferLetter[]).length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No offer letters yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Candidate', 'Designation', 'CTC', 'Joining Date', 'Expiry', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(offers as OfferLetter[]).map(offer => {
                const cfg = STATUS_CONFIG[offer.status] ?? { label: offer.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={offer.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-sm text-gray-900">{offer.candidate_name}</p>
                      <p className="text-xs text-gray-400">{offer.candidate_email}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{(offer.designation as any)?.name ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {offer.offered_ctc ? `₹${Number(offer.offered_ctc).toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{offer.joining_date ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{offer.expiry_date ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => preview.open(offer.id)}
                          disabled={preview.loading === offer.id}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                          title="Preview">
                          {preview.loading === offer.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <ExternalLink className="w-4 h-4" />}
                        </button>
                        {offer.status === 'draft' && (
                          <>
                            <button onClick={() => sendOffer.mutate(offer.id)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Send">
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => { if (await askConfirm('Delete this offer letter?')) deleteOffer.mutate(offer.id) }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CreateOfferModal
          departments={departments as any[]}
          designations={designations as any[]}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
