import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies } from '@/hooks/useFinance'
import { useActivityTypes, useCreateActivityType } from '@/hooks/useControlling'
import { toast } from 'sonner'
import { Activity, ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const fieldClass =
  'h-10 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const labelClass = 'flex flex-col gap-1 text-xs text-muted-foreground'
const cardClass = 'rounded-xl border border-border bg-card p-4 space-y-3'

const UOM_LABELS: Record<string, string> = {
  H: 'Hours',
  MH: 'Machine hrs',
  EA: 'Each',
}

export default function ActivityTypesPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: activities = [], refetch } = useActivityTypes(activeCo || undefined)
  const createAct = useCreateActivityType()

  const [actForm, setActForm] = useState({ code: '', name: '', uom: 'H' })

  const addActivity = async () => {
    if (!activeCo || !actForm.code) return
    try {
      await createAct.mutateAsync({
        company_id: activeCo,
        code: actForm.code,
        name: actForm.name || actForm.code,
        uom: actForm.uom,
      })
      toast.success('Activity type saved')
      setActForm({ code: '', name: '', uom: 'H' })
      refetch()
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
            <Activity className="w-7 h-7 text-primary" /> Activity Types
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define activity drivers used in routings, confirmations, and activity-based costing.
          </p>
        </div>
        {companies.length > 0 && (
          <label className={labelClass}>
            Company
            <Select
              value={activeCo}
              onChange={setCompanyId}
              className={cn(fieldClass, 'min-w-[200px]')}
              options={companies.map(c => ({ value: String(c.id), label: String(c.code) }))}
            />
          </label>
        )}
      </div>

      <div className={cardClass}>
        <h2 className="font-semibold text-foreground">Add activity type</h2>
        <div className="flex flex-wrap items-end gap-2">
          <input
            placeholder="Code"
            value={actForm.code}
            onChange={e => setActForm(f => ({ ...f, code: e.target.value }))}
            className={cn(fieldClass, 'w-28')}
          />
          <input
            placeholder="Name"
            value={actForm.name}
            onChange={e => setActForm(f => ({ ...f, name: e.target.value }))}
            className={cn(fieldClass, 'min-w-[120px] flex-1')}
          />
          <Select
            value={actForm.uom}
            onChange={v => setActForm(f => ({ ...f, uom: v }))}
            className={fieldClass}
            options={[
              { value: 'H', label: 'Hours' },
              { value: 'MH', label: 'Machine hrs' },
              { value: 'EA', label: 'Each' },
            ]}
          />
          <Button type="button" size="sm" onClick={addActivity} className="h-10 gap-1">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
        <ul className="max-h-[28rem] divide-y divide-border overflow-auto text-sm">
          {activities.length === 0 ? (
            <li className="py-6 text-center text-muted-foreground">No activity types yet.</li>
          ) : (
            activities.map((a: { id: string; code: string; name: string; uom: string }) => (
              <li key={a.id} className="flex justify-between gap-2 py-2.5">
                <span className="font-mono text-primary">{a.code}</span>
                <span className="flex-1 text-foreground">{a.name}</span>
                <span className="text-xs text-muted-foreground">{UOM_LABELS[a.uom] ?? a.uom}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
