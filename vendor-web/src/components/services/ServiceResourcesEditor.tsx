import { useState, useEffect, useCallback, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Plus, Trash2, Save, Loader2, Users, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServiceResources, useUpdateServiceResources, useHREmployees } from '@/hooks/useVendor'

interface ResourceRow {
  resource_type: string
  resource_id: string
  resource_name: string
  quantity: number
  duration_minutes: string
  cost_type: string
  cost_rate: string
  auto_reserve: boolean
  notes: string
  id?: string
  line_cost?: number
}

interface ServiceResourcesEditorProps {
  serviceId: string
  serviceName?: string
  defaultDurationMinutes?: number
}

const RESOURCE_TYPES = [
  { value: 'employee', label: 'Employee / Technician' },
  { value: 'work_center', label: 'Work Center / Station' },
  { value: 'equipment', label: 'Equipment / Tool' },
  { value: 'room', label: 'Room / Facility' },
]

function calcLineCost(row: ResourceRow): number {
  const qty = row.quantity || 1
  const rate = parseFloat(row.cost_rate) || 0
  if (row.cost_type === 'fixed') return qty * rate
  const mins = parseInt(row.duration_minutes, 10) || 0
  const hours = mins > 0 ? mins / 60 : 1
  return qty * rate * hours
}

export function ServiceResourcesEditor({ serviceId, serviceName, defaultDurationMinutes }: ServiceResourcesEditorProps) {
  const { data: resourcesData, isLoading } = useServiceResources(serviceId)
  const updateResources = useUpdateServiceResources()
  const { data: empData } = useHREmployees({ size: 200, status: 'active' })
  const employees = useMemo(() => {
    const items = Array.isArray(empData) ? empData : (empData as { items?: unknown[] })?.items ?? []
    return items as Array<{ id: string; employee_code?: string; full_name?: string; vendor_user?: { user?: { full_name?: string } } }>
  }, [empData])

  const [rows, setRows] = useState<ResourceRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [empSearch, setEmpSearch] = useState<Record<number, string>>({})
  const [showEmpPicker, setShowEmpPicker] = useState<number | null>(null)

  useEffect(() => {
    if (resourcesData) {
      setRows(
        (resourcesData as Record<string, unknown>[]).map(item => ({
          id: item.id as string,
          resource_type: (item.resource_type as string) || 'employee',
          resource_id: (item.resource_id as string) || '',
          resource_name: item.resource_name as string,
          quantity: Number(item.quantity ?? 1),
          duration_minutes: item.duration_minutes != null ? String(item.duration_minutes) : (defaultDurationMinutes ? String(defaultDurationMinutes) : ''),
          cost_type: (item.cost_type as string) || 'hourly',
          cost_rate: item.cost_rate != null ? String(item.cost_rate) : '',
          auto_reserve: item.auto_reserve !== false,
          notes: (item.notes as string) ?? '',
          line_cost: Number(item.line_cost ?? 0),
        }))
      )
      setDirty(false)
    }
  }, [resourcesData, defaultDurationMinutes])

  const totalResourceCost = useMemo(() => rows.reduce((sum, row) => sum + calcLineCost(row), 0), [rows])

  const addRow = () => {
    setRows(r => [...r, {
      resource_type: 'employee', resource_id: '', resource_name: '',
      quantity: 1, duration_minutes: defaultDurationMinutes ? String(defaultDurationMinutes) : '60',
      cost_type: 'hourly', cost_rate: '', auto_reserve: true, notes: '',
    }])
    setDirty(true)
  }

  const removeRow = (idx: number) => {
    setRows(r => r.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const updateRow = useCallback((idx: number, field: keyof ResourceRow, value: string | number | boolean) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    setDirty(true)
  }, [])

  const selectEmployee = (idx: number, emp: { id: string; full_name?: string; employee_code?: string; vendor_user?: { user?: { full_name?: string } } }) => {
    const name = emp.vendor_user?.user?.full_name || emp.full_name || emp.employee_code || 'Employee'
    setRows(r => r.map((row, i) => i === idx ? {
      ...row, resource_id: emp.id, resource_name: name, resource_type: 'employee',
    } : row))
    setShowEmpPicker(null)
    setEmpSearch(s => ({ ...s, [idx]: '' }))
    setDirty(true)
  }

  const handleSave = async () => {
    const validRows = rows.filter(r => r.resource_name.trim())
    await updateResources.mutateAsync({
      serviceId,
      items: validRows.map((r, idx) => ({
        resource_type: r.resource_type,
        resource_id: r.resource_id || undefined,
        resource_name: r.resource_name.trim(),
        quantity: r.quantity,
        duration_minutes: r.duration_minutes ? parseInt(r.duration_minutes, 10) : undefined,
        cost_type: r.cost_type,
        cost_rate: parseFloat(r.cost_rate) || 0,
        auto_reserve: r.auto_reserve,
        notes: r.notes || undefined,
        sort_order: idx,
      })),
    })
    setDirty(false)
  }

  const filteredEmployees = (idx: number) => {
    const q = (empSearch[idx] || '').toLowerCase()
    return employees
      .filter(e => {
        const name = (e.vendor_user?.user?.full_name || e.full_name || e.employee_code || '').toLowerCase()
        return !q || name.includes(q) || (e.employee_code || '').toLowerCase().includes(q)
      })
      .slice(0, 8)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading service resources…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">
            People, equipment, and facilities needed to perform <strong>{serviceName || 'this service'}</strong>.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Define resource requirements for planning and cost estimation. Auto-reserve flags staff/equipment for booking scheduling.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={updateResources.isPending} className="gap-1.5 shrink-0">
            {updateResources.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Resources
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated resource cost per service</span>
          <span className="font-semibold text-foreground">₹{totalResourceCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No resources defined yet</p>
          <p className="text-xs text-gray-400 mb-4">Add technicians, equipment, rooms, or work centers required for this service</p>
          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Resource
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold"><TableColumnLabel>Type</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[28%]"><TableColumnLabel>Resource</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[8%]"><TableColumnLabel>Qty</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Duration</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Cost Type</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[10%]"><TableColumnLabel>Rate (₹)</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[8%]"><TableColumnLabel>Cost</TableColumnLabel></th>
                <th className="px-3 py-2.5 text-left font-semibold w-[6%]"><TableColumnLabel>Reserve</TableColumnLabel></th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <select value={row.resource_type} onChange={e => updateRow(idx, 'resource_type', e.target.value)}
                      className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white">
                      {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 relative">
                    {row.resource_type === 'employee' ? (
                      <>
                        <button type="button" onClick={() => setShowEmpPicker(showEmpPicker === idx ? null : idx)}
                          className={`w-full text-left px-2 py-1.5 rounded border text-xs truncate ${
                            row.resource_name ? 'border-gray-200' : 'border-dashed border-gray-300 text-gray-400'
                          }`}>
                          {row.resource_name || '— select employee —'}
                        </button>
                        {showEmpPicker === idx && (
                          <div className="absolute top-full left-0 z-50 mt-1 w-64 bg-popover border rounded-xl shadow-xl">
                            <div className="p-2 border-b flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-gray-400" />
                              <input autoFocus value={empSearch[idx] || ''}
                                onChange={e => setEmpSearch(s => ({ ...s, [idx]: e.target.value }))}
                                placeholder="Search employees…" className="flex-1 text-xs outline-none" />
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {filteredEmployees(idx).map(e => (
                                <button key={e.id} type="button" onClick={() => selectEmployee(idx, e)}
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs">
                                  {e.vendor_user?.user?.full_name || e.full_name || e.employee_code}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <Input value={row.resource_name} onChange={e => updateRow(idx, 'resource_name', e.target.value)}
                        placeholder="Name or description" className="text-xs h-8" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0.01} step={1} value={row.quantity}
                      onChange={e => updateRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                      className="w-16 text-xs h-8" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={row.duration_minutes}
                      onChange={e => updateRow(idx, 'duration_minutes', e.target.value)}
                      placeholder="min" className="w-20 text-xs h-8" disabled={row.cost_type === 'fixed'} />
                  </td>
                  <td className="px-3 py-2">
                    <select value={row.cost_type} onChange={e => updateRow(idx, 'cost_type', e.target.value)}
                      className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white">
                      <option value="hourly">Per Hour</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} step={0.01} value={row.cost_rate}
                      onChange={e => updateRow(idx, 'cost_rate', e.target.value)}
                      placeholder="0" className="w-20 text-xs h-8" />
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-gray-700">
                    ₹{calcLineCost(row).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={row.auto_reserve}
                      onChange={e => updateRow(idx, 'auto_reserve', e.target.checked)} className="rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <Button type="button" size="sm" variant="outline" onClick={addRow} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Resource
            </Button>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={updateResources.isPending} className="gap-1.5">
                {updateResources.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Resources
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
