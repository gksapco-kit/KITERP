import { useState } from 'react'
import { Download, BarChart2 } from 'lucide-react'
import { useHRAttendanceReport, useHREmployees } from '@/hooks/useVendor'
import type { AttendanceSummary } from '@/types'

export default function AttendanceReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data, isLoading } = useHRAttendanceReport(month, year)
  const { data: empData } = useHREmployees({ limit: 200 })

  const summary: AttendanceSummary[] = data?.summary ?? []
  const employees = empData?.items ?? []

  function empName(empId: string) {
    const e = employees.find((e: any) => e.id === empId)
    return e?.vendor_user?.user?.full_name ?? e?.employee_code ?? empId.slice(0, 8)
  }

  function downloadCSV() {
    const headers = ['Employee', 'Code', 'Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Week Off', 'OT Hours', 'Total Hours']
    const rows = summary.map(s => [
      empName(s.employee_id), s.employee_code,
      s.present, s.absent, s.late, s.half_day, s.on_leave, s.holiday, s.week_off,
      s.overtime_hours.toFixed(1), s.total_work_hours.toFixed(1),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `attendance_${year}_${String(month).padStart(2, '0')}.csv`
    a.click()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Report</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly summary per employee</p>
        </div>
        <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4 flex gap-3">
        <select className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'long' })}</option>
          ))}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : summary.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No attendance data for this period.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Employee', 'Code', 'Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'OT Hours', 'Total Hrs'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.employee_id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium text-gray-900">{empName(s.employee_id)}</td>
                  <td className="py-3 px-3 text-gray-500">{s.employee_code}</td>
                  <td className="py-3 px-3"><span className="font-semibold text-green-700">{s.present}</span></td>
                  <td className="py-3 px-3"><span className="font-semibold text-red-700">{s.absent}</span></td>
                  <td className="py-3 px-3"><span className="font-semibold text-orange-700">{s.late}</span></td>
                  <td className="py-3 px-3 text-gray-600">{s.half_day}</td>
                  <td className="py-3 px-3 text-gray-600">{s.on_leave}</td>
                  <td className="py-3 px-3 text-gray-600">{s.overtime_hours.toFixed(1)}</td>
                  <td className="py-3 px-3 font-medium text-gray-900">{s.total_work_hours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
