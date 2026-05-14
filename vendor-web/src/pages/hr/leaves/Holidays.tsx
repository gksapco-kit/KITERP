import { useState } from 'react'
import { Plus, Trash2, Star } from 'lucide-react'
import { useHRHolidays, useCreateHoliday, useDeleteHoliday } from '@/hooks/useVendor'
import type { Holiday } from '@/types'

export default function HolidaysPage() {
  const year = new Date().getFullYear()
  const { data: holidaysRaw = [], isLoading } = useHRHolidays(year)
  const holidays = holidaysRaw as Holiday[]
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', is_optional: false, year })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await createHoliday.mutateAsync(form)
    setShowAdd(false)
    setForm({ name: '', date: '', is_optional: false, year })
  }

  const grouped = holidays.reduce((acc: Record<string, Holiday[]>, h: Holiday) => {
    const month = new Date(h.date).toLocaleDateString('en-IN', { month: 'long' })
    acc[month] = [...(acc[month] ?? []), h]
    return acc
  }, {})

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar {year}</h1>
          <p className="text-sm text-gray-500 mt-1">{holidays.length} holidays configured</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Holiday
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border shadow-sm p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-sm">New Holiday</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Diwali" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_optional} onChange={e => setForm(f => ({ ...f, is_optional: e.target.checked }))} className="rounded" />
            Optional Holiday
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={createHoliday.isPending} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">Add</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading…</div>
      ) : holidays.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border shadow-sm">
          <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No holidays added yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b">
                <h3 className="font-semibold text-sm text-gray-700">{month}</h3>
              </div>
              <div className="divide-y">
                {items.map((h: Holiday) => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="text-center w-10">
                        <p className="text-sm font-bold text-blue-600">{new Date(h.date).getDate()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{h.name}</p>
                        {h.is_optional && <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Optional</span>}
                      </div>
                    </div>
                    <button onClick={() => { if (confirm(`Remove "${h.name}"?`)) deleteHoliday.mutate(h.id) }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
