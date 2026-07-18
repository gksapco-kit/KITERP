import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase,
  Building2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react'
import { adminApi } from '@/api/admin.api'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STATUSES = ['', 'new', 'reviewed', 'shortlisted', 'rejected'] as const

export default function CareerApplications() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const allowed = isPlatformStaff(user)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-career-applications', statusFilter],
    queryFn: () => adminApi.listCareerApplications({ status: statusFilter || undefined, size: 50 }),
    enabled: allowed,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateCareerApplication(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-career-applications'] }),
  })

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-primary" />
          Careers
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Applications submitted from the KIT ERP Careers page (details, passport photo, and CV).
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
          No career applications yet.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((app) => (
            <div key={app.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  {app.photo_url ? (
                    <img
                      src={mediaUrl(app.photo_url)}
                      alt={app.full_name}
                      className="h-14 w-12 shrink-0 rounded-md object-cover border border-gray-100"
                    />
                  ) : (
                    <div className="h-14 w-12 shrink-0 rounded-md bg-gray-50 border border-dashed border-gray-200" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{app.full_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {app.created_at ? new Date(app.created_at).toLocaleString() : '—'}
                      {app.experience_years != null ? ` · ${app.experience_years} yrs exp` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 h-fit">
                  {app.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
                {app.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <a href={`mailto:${app.email}`} className="hover:underline">
                      {app.email}
                    </a>
                  </span>
                )}
                {app.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <a href={`tel:${app.phone}`} className="hover:underline">
                      {app.phone}
                    </a>
                  </span>
                )}
                {app.city && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {app.city}
                  </span>
                )}
                {app.company && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {app.company}
                  </span>
                )}
              </div>

              {app.cover_note && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap border-t pt-3">{app.cover_note}</p>
              )}

              <div className="flex flex-wrap gap-3 border-t pt-3">
                {app.cv_url && (
                  <a
                    href={mediaUrl(app.cv_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {app.cv_filename || 'View CV'}
                  </a>
                )}
                {app.photo_url && (
                  <a
                    href={mediaUrl(app.photo_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    View photo
                  </a>
                )}
              </div>

              {isSuperuserAdmin(user) && app.status !== 'rejected' && (
                <div className="flex flex-wrap gap-2">
                  {app.status === 'new' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: app.id, status: 'reviewed' })}
                    >
                      Mark reviewed
                    </Button>
                  )}
                  {(app.status === 'new' || app.status === 'reviewed') && (
                    <Button
                      size="sm"
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: app.id, status: 'shortlisted' })}
                    >
                      Shortlist
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: app.id, status: 'rejected' })}
                  >
                    Reject
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
