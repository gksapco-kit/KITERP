import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Star, CalendarDays, Pencil, X } from 'lucide-react'
import {
  useHRHolidays, useCreateHoliday, useDeleteHoliday,
  useHRHolidayCalendars, useCreateHolidayCalendar, useUpdateHolidayCalendar, useDeleteHolidayCalendar,
} from '@/hooks/useVendor'
import type { Holiday, HolidayCalendar } from '@/types'
import { askConfirm } from '@/components/common/ConfirmProvider'

function CalendarModal({
  calendar,
  onClose,
}: { calendar?: HolidayCalendar | null; onClose: () => void }) {
  const create = useCreateHolidayCalendar()
  const update = useUpdateHolidayCalendar()
  const [form, setForm] = useState({
    name: calendar?.name ?? '',
    is_default: calendar?.is_default ?? false,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (calendar) {
      await update.mutateAsync({ id: calendar.id, data: form })
    } else {
      await create.mutateAsync(form)
    }
    onClose()
  }

  const busy = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">{calendar ? 'Edit Calendar' : 'New Holiday Calendar'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Calendar Name *</Label>
            <input
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Head Office, Factory – Chennai"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded" />
            Default calendar (used for employees without a specific assignment)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Saving…' : calendar ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function HolidaysPage() {
  const year = new Date().getFullYear()
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | 'all'>('all')
  const [calModal, setCalModal] = useState<{ open: boolean; calendar?: HolidayCalendar | null }>({ open: false })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', is_optional: false, year, calendar_id: '' })

  const { data: calendarsRaw = [], isLoading: calsLoading } = useHRHolidayCalendars()
  const calendars = calendarsRaw as HolidayCalendar[]

  const calendarIdParam = selectedCalendarId === 'all' ? undefined : selectedCalendarId
  const { data: holidaysRaw = [], isLoading } = useHRHolidays(year, calendarIdParam)
  const holidays = holidaysRaw as Holiday[]

  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()
  const deleteCal = useDeleteHolidayCalendar()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = { ...form, year }
    if (!payload.calendar_id) delete payload.calendar_id
    await createHoliday.mutateAsync(payload)
    setShowAdd(false)
    setForm({ name: '', date: '', is_optional: false, year, calendar_id: '' })
  }

  const grouped = holidays.reduce((acc: Record<string, Holiday[]>, h: Holiday) => {
    const month = new Date(h.date).toLocaleDateString('en-IN', { month: 'long' })
    acc[month] = [...(acc[month] ?? []), h]
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar {year}</h1>
          <p className="text-sm text-gray-500 mt-1">{holidays.length} holidays shown</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCalModal({ open: true, calendar: null })}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <CalendarDays className="w-4 h-4" /> Manage Calendars
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Holiday
          </button>
        </div>
      </div>

      {/* Calendar tabs */}
      {!calsLoading && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setSelectedCalendarId('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCalendarId === 'all' ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
          {calendars.map((cal) => (
            <div key={cal.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedCalendarId(cal.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCalendarId === cal.id ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
              >
                {cal.name}
                {cal.is_default && <span className="ml-1 text-xs opacity-70">(default)</span>}
              </button>
              <button
                onClick={() => setCalModal({ open: true, calendar: cal })}
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                title="Edit calendar"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={async () => {
                  if (await askConfirm(`Delete calendar "${cal.name}"? Holidays in it will become unassigned.`))
                    deleteCal.mutate(cal.id)
                }}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                title="Delete calendar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {calendars.length === 0 && (
            <p className="text-xs text-gray-400 italic">No calendars yet — add one to separate holiday sets by location/dept.</p>
          )}
        </div>
      )}

      {/* Add holiday form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-card border border-border text-foreground rounded-xl shadow-2xl p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-sm">New Holiday</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1" required>Name</Label>
              <input required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Diwali" />
            </div>
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1" required>Date</Label>
              <input type="date" required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs font-medium text-gray-600 mb-1">Calendar (optional)</Label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.calendar_id}
                onChange={e => setForm(f => ({ ...f, calendar_id: e.target.value }))}
              >
                <option value="">All calendars (global)</option>
                {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                <input type="checkbox" checked={form.is_optional} onChange={e => setForm(f => ({ ...f, is_optional: e.target.checked }))} className="rounded" />
                Optional holiday
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-cancel px-3 py-1.5 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={createHoliday.isPending} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg disabled:opacity-50">Add</button>
          </div>
        </form>
      )}

      {/* Holiday list */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading…</div>
      ) : holidays.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border shadow-sm">
          <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No holidays for this selection.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month} className="bg-card border border-border text-foreground rounded-xl shadow-sm overflow-hidden">
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {h.is_optional && <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Optional</span>}
                          {h.calendar ? (
                            <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{h.calendar.name}</span>
                          ) : (
                            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">All calendars</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => { if (await askConfirm(`Remove "${h.name}"?`)) deleteHoliday.mutate(h.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {calModal.open && (
        <CalendarModal calendar={calModal.calendar} onClose={() => setCalModal({ open: false })} />
      )}
    </div>
  )
}
