import { Users } from 'lucide-react'

/** Manager view for team attendance — placeholder until team APIs are wired in ESS. */
export default function AttendanceTeamPanel() {
  return (
    <div className="mt-6 bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-gray-900">Team attendance</h3>
      </div>
      <p className="text-sm text-gray-500">
        You can manage team attendance from the vendor HR dashboard. Team clock-in from this portal will be available in a future update.
      </p>
    </div>
  )
}
