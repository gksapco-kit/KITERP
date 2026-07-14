import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquareText, Mail, Phone } from 'lucide-react'
import { adminApi } from '@/api/admin.api'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { Button } from '@/components/ui/button'

const STATUSES = ['', 'new', 'read', 'resolved'] as const

export default function ContactQueries() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const allowed = isPlatformStaff(user)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-contact-queries', statusFilter],
    queryFn: () => adminApi.listContactQueries({ status: statusFilter || undefined, size: 50 }),
    enabled: allowed,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateContactQuery(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-contact-queries'] }),
  })

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquareText className="w-6 h-6 text-primary" />
          Queries
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Customer messages submitted from storefront Contact Us pages (name, email, phone, and issue).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusFilter === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">
          No queries yet.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{q.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {q.vendor_display_name || 'Store'} ·{' '}
                    {q.created_at ? new Date(q.created_at).toLocaleString() : '—'}
                  </p>
                </div>
                <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 h-fit">
                  {q.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                {q.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <a href={`mailto:${q.email}`} className="hover:underline">
                      {q.email}
                    </a>
                  </span>
                )}
                {q.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <a href={`tel:${q.phone}`} className="hover:underline">
                      {q.phone}
                    </a>
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-800 whitespace-pre-wrap border-t pt-3">{q.message}</p>

              {isSuperuserAdmin(user) && (q.status === 'new' || q.status === 'read') && (
                <div className="flex flex-wrap gap-2">
                  {q.status === 'new' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: q.id, status: 'read' })}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: q.id, status: 'resolved' })}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
