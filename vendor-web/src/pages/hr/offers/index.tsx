import { onModalBackdropClick } from '@/lib/utils'
import { useState, useMemo } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate } from 'react-router-dom'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Plus, Send, ExternalLink, Trash2, FileText, Settings2, Loader2, X } from 'lucide-react'
import {
  useHROffers, useCreateHROffer, useDeleteHROffer, useSendHROffer,
  useHRDepartments, useHRDesignations, useHROfferTemplates, useStores,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { OfferLetter, OfferLetterTemplate } from '@/types'

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

// ── New Offer Modal ───────────────────────────────────────────────────────────
function CreateOfferModal({
  departments, designations, onClose,
}: {
  departments: any[]; designations: any[]; onClose: () => void
}) {
  const create    = useCreateHROffer()
  const navigate  = useNavigate()

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
    template_id:     '',   // chosen template
  })

  const { data: storeData }     = useStores({ limit: 100 })
  const stores: any[]           = (storeData as any)?.stores ?? storeData ?? []

  // Re-fetch templates whenever role/dept/store changes
  const scopeParams = useMemo(() => ({
    designation_id: form.designation_id || undefined,
    department_id:  form.department_id  || undefined,
    store_id:       form.store_id       || undefined,
  }), [form.designation_id, form.department_id, form.store_id])

  const { data: templates = [] } = useHROfferTemplates(scopeParams)

  // Auto-select best template when scope changes (first match)
  const bestTemplate = templates[0] ?? null

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

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
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold mb-4">New Offer Letter</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Template picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Template</label>
              <button type="button" onClick={() => navigate('/hr/offers/templates')}
                className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                <Settings2 className="w-3 h-3" /> Manage templates
              </button>
            </div>
            <select
              value={form.template_id}
              onChange={e => set('template_id', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">
                {bestTemplate
                  ? `Auto: ${tplLabel(bestTemplate)}`
                  : '— No template (system default) —'}
              </option>
              {templates.map((t: OfferLetterTemplate) => (
                <option key={t.id} value={t.id}>{tplLabel(t)}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                No templates yet.{' '}
                <button type="button" onClick={() => navigate('/hr/offers/templates')} className="text-blue-500 hover:underline">Create one</button>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Candidate */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Candidate Name *</label>
              <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.candidate_name} onChange={e => set('candidate_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.candidate_email} onChange={e => set('candidate_email', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <PhoneInput value={form.candidate_phone} onChange={v => set('candidate_phone', v)} defaultCountryIso="IN" />
            </div>

            {/* Role + Entity scope */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.designation_id} onChange={e => set('designation_id', e.target.value)}>
                <option value="">— None —</option>
                {designations.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                <option value="">— None —</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Store / Branch</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.store_id} onChange={e => set('store_id', e.target.value)}>
                <option value="">— None —</option>
                {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Offer details */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CTC (Annual ₹)</label>
              <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.offered_ctc} onChange={e => set('offered_ctc', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Offer Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.offered_date} onChange={e => set('offered_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Joining Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Offer Expiry</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary/90">
              {create.isPending ? 'Creating…' : 'Create Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
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

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
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
                              onClick={() => { if (confirm('Delete this offer letter?')) deleteOffer.mutate(offer.id) }}
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
