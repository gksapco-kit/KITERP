import { useEffect, useMemo, useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/finance'
import { Loader2, Save, Shield, Info, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

export default function CreateCalendarModal({
 open, onClose, companies }: Props) {
  useEscapeToClose(onClose, open)

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
          ? `Fiscal year created and linked to ${n} business units.`
          : 'Fiscal year created and linked to the business unit.',
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
          ? 'Add at least one business unit before creating a calendar for all.'
          : 'Select a business unit, or choose "Every business unit".',
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

  const fieldClass = 'mt-0.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground [color-scheme:dark]'
  const labelClass = 'text-xs font-bold uppercase text-muted-foreground'

  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-cal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
          <h2 id="create-cal-title" className="min-w-0 text-lg font-semibold text-foreground">
            New fiscal calendar
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" form={formId} size="sm" disabled={createFyMut.isPending}>
              {createFyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {createFyMut.isPending ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <form id={formId} onSubmit={onSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-xs text-muted-foreground">
            Set <strong className="text-foreground">fiscal pattern</strong> and year, link to one or all business units, optional post-close audit.
            Internal code is set from your pattern and dates.
          </p>
          <div>
            <label className={labelClass}>Fiscal pattern</label>
            <select
              value={tpl}
              onChange={e => { setTpl(e.target.value as typeof tpl) }}
              className={fieldClass}
            >
              {TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <label className="flex max-w-xl cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-input"
              checked={createForAllCompanies}
              onChange={e => {
                setCreateForAllCompanies(e.target.checked)
                if (e.target.checked) setCreateAssignCompanyId('')
              }}
            />
            <span>
              Link to <strong>every</strong> business unit ({companies.length}{' '}
              {companies.length === 1 ? 'code' : 'codes'})
            </span>
          </label>
          <div>
            <label className={labelClass}>Business unit</label>
            <select
              value={createAssignCompanyId}
              onChange={e => { setCreateAssignCompanyId(e.target.value) }}
              className={cn(fieldClass, 'max-w-md disabled:bg-muted disabled:text-muted-foreground')}
              disabled={createForAllCompanies}
              required={!createForAllCompanies}
            >
              <option value="">— Select business unit —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {createForAllCompanies && (
              <p className="mt-1 text-xs text-primary">
                One shared calendar; linked to all listed business units.
              </p>
            )}
          </div>
          {tpl !== 'custom' && (
            <div>
              <label className={labelClass}>Start year of FY</label>
              <input
                type="number"
                className={cn(fieldClass, 'max-w-xs')}
                value={yearAnchor}
                onChange={e => { setYearAnchor(Number(e.target.value)) }}
                min={1970}
                max={2200}
              />
              {tpl === 'apr_mar' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Apr–Mar: <strong className="text-foreground">April</strong> year (e.g. 2026 → 1 Apr 2026–31 Mar 2027).
                </p>
              )}
              {tpl === 'jul_jun' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Jul–Jun: <strong className="text-foreground">July</strong> year (e.g. 2026 → 1 Jul 2026–30 Jun 2027).
                </p>
              )}
              {tpl === 'jan_dec' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Calendar year <strong className="text-foreground">{yearAnchor}</strong>.
                </p>
              )}
            </div>
          )}
          {tpl === 'custom' && (
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Fiscal start</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={customStart}
                  onChange={e => { setCustomStart(e.target.value) }}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Fiscal end</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value) }}
                  required
                />
              </div>
            </div>
          )}
          {newFyPreview && (
            <div className="flex gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm text-foreground dark:bg-sky-950/40">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <div>
                <p className="font-semibold">Preview</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{newFyPreview.label}</span>
                  {' · '}
                  {formatIsoDate(newFyPreview.start)} — {formatIsoDate(newFyPreview.end)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong className="text-foreground">Audit</strong> (below) is post-close: the day <strong className="text-foreground">after</strong> this range ends.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2 rounded-lg border border-dashed border-amber-500/35 bg-amber-500/10 p-3 dark:bg-amber-950/25">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
              <Shield className="h-3.5 w-3.5" />
              Optional audit / adjustment (on create)
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <input
                placeholder="Label e.g. Audit-1"
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground"
                value={auditName}
                onChange={e => { setAuditName(e.target.value) }}
              />
              <input
                type="date"
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground [color-scheme:dark]"
                value={auditStart}
                onChange={e => { setAuditStart(e.target.value) }}
              />
              <input
                type="date"
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground [color-scheme:dark]"
                value={auditEnd}
                onChange={e => { setAuditEnd(e.target.value) }}
              />
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
              A date range spanning more than one month is stored as one audit period per month.
            </p>
            {auditOutOfRangeCreate && (
              <p className="text-xs font-medium text-destructive" role="alert">
                {auditOutOfRangeCreate}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={createAssignAsCurrent}
              onChange={e => { setCreateAssignAsCurrent(e.target.checked) }}
            />
            Set as <strong>current</strong> fiscal year for each linked business unit
          </label>
        </form>
      </div>
    </div>
  )
}
