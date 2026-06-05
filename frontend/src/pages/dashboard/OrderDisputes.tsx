import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { adminApi } from '@/api/admin.api'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { Button } from '@/components/ui/button'

const STATUSES = ['', 'open', 'investigating', 'resolved', 'rejected'] as const

export default function OrderDisputes() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const allowed = isPlatformStaff(user) && isSuperuserAdmin(user)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes', statusFilter],
    queryFn: () => adminApi.listOrderDisputes({ status: statusFilter || undefined, size: 50 }),
    enabled: allowed,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status, resolution_notes }: { id: string; status: string; resolution_notes?: string }) =>
      adminApi.updateOrderDispute(id, { status, resolution_notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-disputes'] }),
  })

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          Order disputes
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Customer-filed disputes routed from storefront orders.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">No disputes found.</p>
      ) : (
        <div className="space-y-4">
          {items.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">Order {d.order_number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {d.dispute_type} · {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
                  </p>
                </div>
                <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {d.status}
                </span>
              </div>
              <p className="text-sm text-gray-700">{d.reason}</p>
              {d.status === 'open' || d.status === 'investigating' ? (
                <div className="flex flex-wrap gap-2 items-end">
                  <textarea
                    className="flex-1 min-w-[200px] rounded-lg border border-gray-200 p-2 text-sm"
                    rows={2}
                    placeholder="Resolution notes (optional)"
                    value={notes[d.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  />
                  {d.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: d.id, status: 'investigating' })}
                    >
                      Investigate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({
                      id: d.id,
                      status: 'resolved',
                      resolution_notes: notes[d.id],
                    })}
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({
                      id: d.id,
                      status: 'rejected',
                      resolution_notes: notes[d.id],
                    })}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
