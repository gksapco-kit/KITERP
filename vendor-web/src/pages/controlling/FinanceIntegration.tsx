import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccounts, useCompanies } from '@/hooks/useFinance'
import { useCoGlMapping, usePutCoGlMapping } from '@/hooks/useControlling'
import { toast } from 'sonner'
import { ArrowLeft, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const fieldClass =
  'h-10 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const labelClass = 'flex flex-col gap-1 text-xs text-muted-foreground'
const cardClass = 'rounded-xl border border-border bg-card p-4 space-y-3'

const GL_FIELDS = [
  ['wip_account_id', 'WIP / production'],
  ['finished_goods_account_id', 'Finished goods'],
  ['cogs_account_id', 'Cost of goods sold'],
  ['production_variance_account_id', 'Production variance (optional)'],
  ['raw_material_account_id', 'Raw material (optional)'],
] as const

export default function FinanceIntegrationPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: accounts = [] } = useAccounts()
  const { data: glMap, refetch: refGl } = useCoGlMapping(activeCo || undefined)
  const putGl = usePutCoGlMapping()

  const [glForm, setGlForm] = useState({
    wip_account_id: '',
    finished_goods_account_id: '',
    cogs_account_id: '',
    production_variance_account_id: '',
    raw_material_account_id: '',
  })

  useEffect(() => {
    if (!glMap) return
    setGlForm({
      wip_account_id: glMap.wip_account_id ?? '',
      finished_goods_account_id: glMap.finished_goods_account_id ?? '',
      cogs_account_id: glMap.cogs_account_id ?? '',
      production_variance_account_id: glMap.production_variance_account_id ?? '',
      raw_material_account_id: glMap.raw_material_account_id ?? '',
    })
  }, [glMap])

  const saveGlMapping = async () => {
    if (!activeCo) return
    const payload: Record<string, unknown> = { company_id: activeCo }
    if (glForm.wip_account_id) payload.wip_account_id = glForm.wip_account_id
    if (glForm.finished_goods_account_id) payload.finished_goods_account_id = glForm.finished_goods_account_id
    if (glForm.cogs_account_id) payload.cogs_account_id = glForm.cogs_account_id
    if (glForm.production_variance_account_id) payload.production_variance_account_id = glForm.production_variance_account_id
    if (glForm.raw_material_account_id) payload.raw_material_account_id = glForm.raw_material_account_id
    try {
      await putGl.mutateAsync(payload)
      toast.success('CO GL mapping saved')
      refGl()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/controlling" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> CO Dashboard
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Landmark className="w-7 h-7 text-primary" /> Finance Integration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Map CO settlement accounts to the general ledger for production completion and cost-of-goods postings.
          </p>
        </div>
        {companies.length > 0 && (
          <label className={labelClass}>
            Company
            <select
              value={activeCo}
              onChange={e => setCompanyId(e.target.value)}
              className={cn(fieldClass, 'min-w-[200px]')}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className={cn(cardClass, 'space-y-4')}>
        <div>
          <h2 className="font-semibold text-foreground">CO — GL Accounts (Settlement)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Map WIP, finished goods, and COGS for production completion and cost-of-goods postings.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {GL_FIELDS.map(([key, label]) => (
            <label key={key} className={labelClass}>
              {label}
              <select
                value={glForm[key]}
                onChange={e => setGlForm(f => ({ ...f, [key]: e.target.value }))}
                className={fieldClass}
              >
                <option value="">—</option>
                {(accounts as { id: string; code: string; name: string }[]).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <Button type="button" size="sm" onClick={saveGlMapping} disabled={!activeCo || putGl.isPending}>
          Save GL mapping
        </Button>
      </div>
    </div>
  )
}
