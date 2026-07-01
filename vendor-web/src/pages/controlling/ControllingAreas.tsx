import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Building2, Plus, Star, Trash2 } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useControllingAreas,
  useCreateControllingArea,
  useUpdateControllingArea,
  useDeleteControllingArea,
  useAssignCompanyToControllingArea,
} from '@/hooks/useControlling'
import type { ControllingArea } from '@/api/controlling'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const fieldClass =
  'h-10 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'
const labelClass = 'flex flex-col gap-1 text-xs text-muted-foreground'
const cardClass = 'rounded-xl border border-border bg-card p-4 space-y-3'

function errMsg(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { detail?: string } } }
  return err.response?.data?.detail || fallback
}

export default function ControllingAreasPage() {
  const { data: areasResp, refetch: refetchAreas } = useControllingAreas()
  const { data: companies = [] } = useCompanies()
  const createArea = useCreateControllingArea()
  const updateArea = useUpdateControllingArea()
  const deleteArea = useDeleteControllingArea()
  const assignCompany = useAssignCompanyToControllingArea()

  const areas = areasResp?.controlling_areas ?? []

  const [form, setForm] = useState({ code: '', name: '', currency: 'INR' })
  const [assignPick, setAssignPick] = useState<Record<string, string>>({})

  // Map company_id -> controlling_area_id, derived from each area's assigned companies.
  const areaOfCompany = new Map<string, string>()
  for (const c of companies as Array<{ id: string; controlling_area_id?: string | null }>) {
    if (c.controlling_area_id) areaOfCompany.set(c.id, c.controlling_area_id)
  }

  const addArea = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name are required')
      return
    }
    try {
      await createArea.mutateAsync({
        code: form.code.trim(),
        name: form.name.trim(),
        currency: form.currency.trim() || 'INR',
      })
      toast.success('Controlling area created')
      setForm({ code: '', name: '', currency: 'INR' })
      refetchAreas()
    } catch (e) {
      toast.error(errMsg(e, 'Failed to create controlling area'))
    }
  }

  const setDefault = async (area: ControllingArea) => {
    try {
      await updateArea.mutateAsync({ id: area.id, data: { is_default: true } })
      toast.success(`${area.code} set as default`)
    } catch (e) {
      toast.error(errMsg(e, 'Failed to update controlling area'))
    }
  }

  const removeArea = async (area: ControllingArea) => {
    if (!window.confirm(`Delete controlling area "${area.name}"?`)) return
    try {
      await deleteArea.mutateAsync(area.id)
      toast.success('Controlling area deleted')
    } catch (e) {
      toast.error(errMsg(e, 'Failed to delete controlling area'))
    }
  }

  const assignToArea = async (areaId: string) => {
    const companyId = assignPick[areaId]
    if (!companyId) return
    try {
      await assignCompany.mutateAsync({ areaId, companyId })
      toast.success('Company assigned')
      setAssignPick(prev => ({ ...prev, [areaId]: '' }))
    } catch (e) {
      toast.error(errMsg(e, 'Failed to assign company'))
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/controlling" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> CO Dashboard
        </Link>
      </div>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Building2 className="w-7 h-7 text-primary" /> Controlling Areas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The CO-level org unit each company (legal entity) posts costs under. Most vendors only need
          one — the "Standard" area — but you can split companies into separate areas when they must be
          kept apart for cost accounting (different CO currency, no shared cost-centre hierarchy, etc.).
        </p>
      </div>

      <div className={cardClass}>
        <h2 className="font-semibold text-foreground">Add controlling area</h2>
        <div className="flex flex-wrap items-end gap-2">
          <input
            placeholder="Code"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            className={cn(fieldClass, 'w-28')}
          />
          <input
            placeholder="Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={cn(fieldClass, 'min-w-[160px] flex-1')}
          />
          <input
            placeholder="Currency"
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
            className={cn(fieldClass, 'w-24')}
            maxLength={3}
          />
          <Button type="button" size="sm" onClick={addArea} className="h-10 gap-1">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {areas.length === 0 ? (
          <div className={cn(cardClass, 'text-center text-sm text-muted-foreground')}>
            No controlling areas yet.
          </div>
        ) : (
          areas.map(area => {
            const assignedCompanies = (companies as Array<{ id: string; code: string; name: string; controlling_area_id?: string | null }>)
              .filter(c => areaOfCompany.get(c.id) === area.id)
            const unassignable = (companies as Array<{ id: string; code: string; name: string }>)
              .filter(c => areaOfCompany.get(c.id) !== area.id)

            return (
              <div key={area.id} className={cardClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-primary">{area.code}</span>
                    <span className="font-semibold text-foreground">{area.name}</span>
                    {area.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        <Star className="w-3 h-3" /> Default
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{area.currency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!area.is_default && (
                      <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setDefault(area)}>
                        Set default
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-destructive"
                      disabled={area.is_default || area.company_count > 0}
                      title={area.is_default ? 'Cannot delete the default area' : area.company_count > 0 ? 'Reassign companies first' : undefined}
                      onClick={() => removeArea(area)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Companies ({assignedCompanies.length})
                  </p>
                  {assignedCompanies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No companies assigned.</p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {assignedCompanies.map(c => (
                        <li key={c.id} className="flex justify-between gap-2 py-1.5">
                          <span className="font-mono text-primary">{c.code}</span>
                          <span className="flex-1 text-foreground">{c.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {unassignable.length > 0 && (
                  <div className="flex items-end gap-2 pt-1">
                    <label className={cn(labelClass, 'flex-1')}>
                      Move a company into this area
                      <select
                        value={assignPick[area.id] || ''}
                        onChange={e => setAssignPick(prev => ({ ...prev, [area.id]: e.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Select company…</option>
                        {unassignable.map(c => (
                          <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-10"
                      disabled={!assignPick[area.id]}
                      onClick={() => assignToArea(area.id)}
                    >
                      Move
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
