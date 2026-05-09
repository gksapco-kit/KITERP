import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/finance'
import { Loader2, Save, Shield, Info, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  buildDefaultVariantCode,
  computeFiscalYearPreview,
  formatIsoDate,
  formatApiDetail,
  isAuditWindowAfterFyEnd,
} from '@/lib/fiscalYearPreview'

const TEMPLATES = [
  { id: 'apr_mar', label: 'Apr – Mar (e.g. India, common APAC corporates)' },
  { id: 'jul_jun', label: 'Jul – Jun (e.g. Australia, some MENA)' },
  { id: 'jan_dec', label: 'Jan – Dec (calendar year, many regions)' },
  { id: 'custom', label: 'Custom (choose start and end dates)' },
] as const

type Company = { id: string; code: string; name: string }

type Props = {
  open: boolean
  onClose: () => void
  companies: Company[]
}

export default function CreateCalendarModal({ open, onClose, companies }: Props) {
  const qc = useQueryClient()
  const [tpl, setTpl] = useState<(typeof TEMPLATES)[number]['id']>('apr_mar')
  const [yearAnchor, setYearAnchor] = useState(new Date().getFullYear())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [auditName, setAuditName] = useState('')
  const [auditStart, setAuditStart] = useState('')
  const [auditEnd, setAuditEnd] = useState('')
  const [createAssignCompanyId, setCreateAssignCompanyId] = useState('')
  const [createForAllCompanies, setCreateForAllCompanies] = useState(false)
  const [createAssignAsCurrent, setCreateAssignAsCurrent] = useState(false)

  useEffect(() => {
    if (!open) return
    setTpl('apr_mar')
    setYearAnchor(new Date().getFullYear())
    setCustomStart('')
    setCustomEnd('')
    setAuditName('')
    setAuditStart('')
    setAuditEnd('')
    setCreateAssignCompanyId('')
    setCreateForAllCompanies(false)
    setCreateAssignAsCurrent(false)
  }, [open])

  const newFyPreview = useMemo(
    () => computeFiscalYearPreview(tpl, yearAnchor, customStart, customEnd),
    [tpl, yearAnchor, customStart, customEnd],
  )
  const autoVariantCode = useMemo(
    () => buildDefaultVariantCode(tpl, yearAnchor, customStart, customEnd),
    [tpl, yearAnchor, customStart, customEnd],
  )
  const auditOutOfRangeCreate = useMemo(() => {
    if (!newFyPreview || !auditName.trim() || !auditStart || !auditEnd) return null
    if (isAuditWindowAfterFyEnd(auditStart, auditEnd, newFyPreview.end)) return null
    if (auditEnd < auditStart) return 'Audit end date must be on or after the start date.'
    return `Audit / adjustment must run entirely after this fiscal year ends (${formatIsoDate(newFyPreview.end)}). For example, start the day after the FY close.`
  }, [newFyPreview, auditName, auditStart, auditEnd])

  const createFyMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.createFiscalYear(payload),
    onSuccess: (_row, vars) => {
      const ids = (vars.company_ids as string[] | undefined) ?? []
      const n = ids.length
      toast.success(
        n > 1
          ? `Fiscal year created and linked to ${n} company codes.`
          : 'Fiscal year created and linked to the company.',
      )
      void qc.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] })
      onClose()
    },
    onError: (e: { response?: { data?: { detail?: unknown } } }) => {
      toast.error(formatApiDetail(e) || 'Could not create fiscal year', { duration: 12_000 })
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targetIds = createForAllCompanies
      ? companies.map(c => c.id)
      : createAssignCompanyId
        ? [createAssignCompanyId]
        : []
    if (targetIds.length === 0) {
      toast.error(
        createForAllCompanies
          ? 'Add at least one company code before creating a calendar for all.'
          : 'Select a company code, or choose "Every company code".',
      )
      return
    }
    const payload: Record<string, unknown> = {
      company_ids: targetIds,
      variant_code: autoVariantCode,
      template: tpl,
      is_current: createAssignAsCurrent,
    }
    if (tpl === 'custom') {
      if (!customStart || !customEnd) {
        toast.error('Select the custom fiscal year start and end dates.')
        return
      }
      payload.start_date = customStart
      payload.end_date = customEnd
    } else {
      payload.year_anchor = yearAnchor
    }
    if (auditName.trim() && auditStart && auditEnd) {
      if (newFyPreview && !isAuditWindowAfterFyEnd(auditStart, auditEnd, newFyPreview.end)) {
        toast.error(
          auditOutOfRangeCreate
            || 'Set the audit window to start after the fiscal year end (the day after the range in the blue box).',
          { duration: 10_000 },
        )
        return
      }
      payload.audit_periods = [
        { name: auditName.trim(), start_date: auditStart, end_date: auditEnd },
      ]
    } else if ((auditName.trim() || auditStart || auditEnd) && !(auditName.trim() && auditStart && auditEnd)) {
      toast.error('For an audit period, fill in label, start date, and end date, or clear all three.')
      return
    }
    createFyMut.mutate(payload)
  }

  const formId = 'create-fiscal-calendar-form'

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-cal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[min(90vh,900px)] flex flex-col border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 shrink-0">
          <h2 id="create-cal-title" className="text-lg font-semibold text-slate-900 min-w-0">
            New fiscal calendar
          </h2>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={createFyMut.isPending}
              className="inline-flex items-center gap-2 text-sm font-medium bg-indigo-600 text-white rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:opacity-50"
            >
              {createFyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {createFyMut.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <form id={formId} onSubmit={onSubmit} className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
          <p className="text-xs text-slate-600">
            Set <strong>fiscal pattern</strong> and year, link to one or all company codes, optional post-close audit.
            Internal code is set from your pattern and dates.
          </p>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Fiscal pattern</label>
            <select
              value={tpl}
              onChange={e => { setTpl(e.target.value as typeof tpl) }}
              className="mt-0.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-800 max-w-xl cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={createForAllCompanies}
              onChange={e => {
                setCreateForAllCompanies(e.target.checked)
                if (e.target.checked) setCreateAssignCompanyId('')
              }}
            />
            <span>
              Link to <strong>every</strong> company code ({companies.length}{' '}
              {companies.length === 1 ? 'code' : 'codes'})
            </span>
          </label>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Company code</label>
            <select
              value={createAssignCompanyId}
              onChange={e => { setCreateAssignCompanyId(e.target.value) }}
              className="mt-0.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm max-w-md disabled:bg-slate-100 disabled:text-slate-500"
              disabled={createForAllCompanies}
              required={!createForAllCompanies}
            >
              <option value="">— Select company —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {createForAllCompanies && (
              <p className="text-[11px] text-emerald-800 mt-1">
                One shared calendar; linked to all listed company codes.
              </p>
            )}
          </div>
          {tpl !== 'custom' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Start year of FY</label>
              <input
                type="number"
                className="mt-0.5 w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={yearAnchor}
                onChange={e => { setYearAnchor(Number(e.target.value)) }}
                min={1970}
                max={2200}
              />
              {tpl === 'apr_mar' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Apr–Mar: <strong>April</strong> year (e.g. 2026 → 1 Apr 2026–31 Mar 2027).
                </p>
              )}
              {tpl === 'jul_jun' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Jul–Jun: <strong>July</strong> year (e.g. 2026 → 1 Jul 2026–30 Jun 2027).
                </p>
              )}
              {tpl === 'jan_dec' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Calendar year <strong>{yearAnchor}</strong>.
                </p>
              )}
            </div>
          )}
          {tpl === 'custom' && (
            <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Fiscal start</label>
                <input
                  type="date"
                  className="mt-0.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={customStart}
                  onChange={e => { setCustomStart(e.target.value) }}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Fiscal end</label>
                <input
                  type="date"
                  className="mt-0.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value) }}
                  required
                />
              </div>
            </div>
          )}
          {newFyPreview && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-sm text-sky-950 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold">Preview</p>
                <p className="text-xs mt-0.5">
                  <span className="font-medium">{newFyPreview.label}</span>
                  {' · '}
                  {formatIsoDate(newFyPreview.start)} — {formatIsoDate(newFyPreview.end)}
                </p>
                <p className="text-[11px] text-sky-900/85 mt-1">
                  <strong>Audit</strong> (below) is post-close: the day <strong>after</strong> this range ends.
                </p>
              </div>
            </div>
          )}
          <div className="border border-dashed border-amber-200 rounded-lg p-3 bg-amber-50/40 space-y-2">
            <p className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Optional audit / adjustment (on create)
            </p>
            <div className="grid sm:grid-cols-3 gap-2 text-sm">
              <input
                placeholder="Label e.g. Audit-1"
                className="border border-slate-200 rounded px-2 py-1.5"
                value={auditName}
                onChange={e => { setAuditName(e.target.value) }}
              />
              <input
                type="date"
                className="border border-slate-200 rounded px-2 py-1.5"
                value={auditStart}
                onChange={e => { setAuditStart(e.target.value) }}
              />
              <input
                type="date"
                className="border border-slate-200 rounded px-2 py-1.5"
                value={auditEnd}
                onChange={e => { setAuditEnd(e.target.value) }}
              />
            </div>
            <p className="text-[11px] text-amber-900/80">
              A date range spanning more than one month is stored as one audit period per month.
            </p>
            {auditOutOfRangeCreate && (
              <p className="text-xs text-red-700 font-medium" role="alert">
                {auditOutOfRangeCreate}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createAssignAsCurrent}
              onChange={e => { setCreateAssignAsCurrent(e.target.checked) }}
            />
            Set as <strong>current</strong> fiscal year for each linked company code
          </label>
          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFyMut.isPending}
              className="inline-flex items-center gap-2 text-sm font-medium bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:opacity-50"
              aria-label="Save fiscal calendar and link to selected company codes"
            >
              {createFyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {createFyMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
