import { useState } from 'react'
import { LogIn, LogOut, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useHRMyToday, useHRClockIn, useHRClockOut, useHRAttendance } from '@/hooks/useVendor'

export default function MyAttendancePage() {
  const { data: today, isLoading } = useHRMyToday()
  const clockIn = useHRClockIn()
  const clockOut = useHRClockOut()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [month, setMonth] = useState(currentMonth)
  const [year] = useState(currentYear)

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const { data: histData } = useHRAttendance({ from_date: from, to_date: to })
  const records = histData?.items ?? []

  const totalPresent = records.filter((r: any) => ['present', 'late'].includes(r.status)).length
  const totalAbsent = records.filter((r: any) => r.status === 'absent').length
  const totalOT = records.reduce((s: number, r: any) => s + Number(r.overtime_hours || 0), 0)

  function handleClockIn() { clockIn.mutate(undefined) }
  function handleClockOut() { clockOut.mutate(undefined) }

  const rec = today?.record
  const clockedIn = today?.clocked_in
  const clockedOut = today?.clocked_out

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Attendance</h1>

      {/* Clock In/Out Card */}
      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            {isLoading ? (
              <p className="text-gray-400 mt-1">Loading…</p>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-700">
                  <Clock className="inline w-4 h-4 mr-1 text-primary" />
                  Clock In: {rec?.clock_in ? new Date(rec.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
                <p className="text-sm text-gray-700">
                  <Clock className="inline w-4 h-4 mr-1 text-primary" />
                  Clock Out: {rec?.clock_out ? new Date(rec.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
                {rec?.work_hours != null && (
                  <p className="text-sm font-medium text-green-700">
                    <CheckCircle className="inline w-4 h-4 mr-1" />
                    {Number(rec.work_hours).toFixed(1)} hours worked
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {!clockedIn ? (
              <button
                onClick={handleClockIn}
                disabled={clockIn.isPending}
                className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium disabled:opacity-50"
              >
                <LogIn className="w-5 h-5" /> Clock In
              </button>
            ) : !clockedOut ? (
              <button
                onClick={handleClockOut}
                disabled={clockOut.isPending}
                className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 font-medium disabled:opacity-50"
              >
                <LogOut className="w-5 h-5" /> Clock Out
              </button>
            ) : (
              <div className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-600 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-500" /> Day Complete
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-center">
          <p className="text-2xl font-bold text-green-800">{totalPresent}</p>
          <p className="text-sm text-green-600">Days Present</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-center">
          <p className="text-2xl font-bold text-red-800">{totalAbsent}</p>
          <p className="text-sm text-red-600">Days Absent</p>
        </div>
        <div className="bg-accent rounded-xl p-4 border border-primary/20 text-center">
          <p className="text-2xl font-bold text-primary">{totalOT.toFixed(1)}h</p>
          <p className="text-sm text-primary">Overtime</p>
        </div>
      </div>

      {/* Month selector + history */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Monthly History</h3>
          <select className="ml-auto border rounded-lg px-3 py-1.5 text-sm" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        {records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No records for this month.</div>
        ) : (
          <div className="divide-y">
            {records.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-gray-500">
                    {r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} →{' '}
                    {r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.work_hours != null && <span className="text-sm text-gray-600">{Number(r.work_hours).toFixed(1)}h</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'present' ? 'bg-green-100 text-green-700' :
                    r.status === 'absent' ? 'bg-red-100 text-red-700' :
                    r.status === 'late' ? 'bg-primary/15 text-primary' :
                    'bg-gray-100 text-gray-600'
                  }`}>{r.status.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
