import { useCallback, useMemo, useRef, useState } from 'react'
import { useAllFiscalYears, useCompanies } from '@/hooks/useFinance'
import { Calendar, AlertTriangle, Plus, ListTree, Save } from 'lucide-react'
import { toast } from 'sonner'
import CreateCalendarModal from '@/components/finance/CreateCalendarModal'
import CompanyFiscalRow from '@/components/finance/CompanyFiscalRow'

type FyRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  variant_code?: string
  period_counts?: { open: number; locked: number; closed: number }
  period_total?: number
  companies?: { company_id: string; is_current: boolean }[]
}

function fiscalYearsForCompany(all: FyRow[], companyId: string): FyRow[] {
  return all.filter(f => f.companies?.some(c => c.company_id === companyId))
}

export default function PeriodControl() {
  const { data: companies = [], isLoading: compLoad } = useCompanies()
  const { data: allFiscalYearRows = [], isLoading: allFyLoad } = useAllFiscalYears()
  const [createOpen, setCreateOpen] = useState(false)
  const auditSaveHandlers = useRef(new Map<string, () => boolean>())

  const registerPageAuditSave = useCallback((companyId: string, trySave: () => 0 | 1 | 2) => {
    auditSaveHandlers.current.set(companyId, trySave)
    return () => {
      auditSaveHandlers.current.delete(companyId)
    }
  }, [])

  const savePendingAuditForms = useCallback(() => {
    let submitted = 0
    let hadValidationIssue = 0
    for (const fn of auditSaveHandlers.current.values()) {
      const r = fn()
      if (r === 1) submitted += 1
      if (r === 2) hadValidationIssue += 1
    }
    if (submitted === 0 && hadValidationIssue === 0) {
      toast.info(
        'Nothing to save. Expand a company code, choose a fiscal year, then fill the audit name and date range.',
        { duration: 10_000 },
      )
    }
  }, [])

  const companyList = useMemo(
    () => [...(companies as { id: string; code: string; name: string }[])].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    ),
    [companies],
  )

  const fys = allFiscalYearRows as FyRow[]

  /** Only companies that already have a fiscal year linked (have periods to manage). */
  const companiesWithCalendars = useMemo(
    () => companyList.filter(c => fiscalYearsForCompany(fys, c.id).length > 0),
    [companyList, fys],
  )

  if (compLoad) {
    return <div className="p-8 text-sm text-slate-500">Loading company codes…</div>
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-indigo-600" />
            GL posting periods
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Only company codes with a <strong>linked</strong> calendar appear here. Expand a row to pick the year and
            control periods. Use <strong>Add calendar</strong> to create and link a new fiscal year. Use{' '}
            <strong>Save</strong> to store pending audit / adjustment lines.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={savePendingAuditForms}
            className="inline-flex items-center gap-2 text-sm font-medium bg-slate-800 text-white rounded-lg px-4 py-2.5 hover:bg-slate-900 shadow-sm"
            title="Save completed audit / adjustment forms in expanded company sections"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            type="button"
            onClick={() => { setCreateOpen(true) }}
            className="inline-flex items-center gap-2 text-sm font-medium bg-indigo-600 text-white rounded-lg px-4 py-2.5 hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add calendar
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <ListTree className="w-4 h-4 text-indigo-500" />
        {allFyLoad && <span>Loading calendars…</span>}
        {!allFyLoad && (
          <span>
            {fys.length} organisation calendar{fys.length === 1 ? '' : 's'} across company codes
          </span>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {companyList.length === 0 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No company codes found. Add a company in Finance / master data, then return here.
          </p>
        )}
        {companyList.length > 0 && !allFyLoad && companiesWithCalendars.length === 0 && (
          <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">
            No company codes have a fiscal calendar yet. Use <strong>Add calendar</strong> to create one and link it
            to a company code — it will show up in this list after it&rsquo;s linked.
          </p>
        )}
        {!allFyLoad && companiesWithCalendars.map(c => (
          <CompanyFiscalRow
            key={c.id}
            company={c}
            fiscalYears={fiscalYearsForCompany(fys, c.id)}
            registerPageAuditSave={registerPageAuditSave}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={savePendingAuditForms}
          className="inline-flex items-center gap-2 text-sm font-medium bg-slate-800 text-white rounded-lg px-4 py-2.5 hover:bg-slate-900 shadow-sm"
          title="Save completed audit / adjustment forms in expanded company sections"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 flex gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p>
          Posting to a period that is <strong>not open</strong> is blocked. Audit windows are <strong>after the FY
            end</strong>. When the posting date matches both a standard month and an audit period, the{' '}
          <strong>audit</strong> period is used for period selection.
        </p>
      </div>

      <CreateCalendarModal
        open={createOpen}
        onClose={() => { setCreateOpen(false) }}
        companies={companyList}
      />
    </div>
  )
}
