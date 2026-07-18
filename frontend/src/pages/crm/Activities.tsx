import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import {
  useCompletePlatformActivity,
  usePlatformActivities,
  useSavePlatformActivity,
} from '@/hooks/usePlatformCrm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CrmSubnav from './CrmSubnav'

const TYPES = ['task', 'call', 'meeting', 'note'] as const

export default function PlatformCrmActivities() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const [status, setStatus] = useState('open')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'task', subject: '', description: '' })

  const { data, isLoading } = usePlatformActivities({
    status: status || undefined,
    size: 50,
  })
  const saveMut = useSavePlatformActivity()
  const completeMut = useCompletePlatformActivity()

  if (!allowed) return <Navigate to="/dashboard" replace />

  const items = data?.items ?? []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim()) {
      toast.error('Subject is required')
      return
    }
    try {
      await saveMut.mutateAsync({
        type: form.type,
        subject: form.subject.trim(),
        description: form.description.trim() || undefined,
        status: 'open',
      })
      toast.success('Task created')
      setForm({ type: 'task', subject: '', description: '' })
      setShowForm(false)
    } catch {
      toast.error('Could not create task')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Platform CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-600 mt-1">Follow-ups, calls, meetings, and notes for platform sales.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Add task
        </Button>
      </div>

      <CrmSubnav />

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                  form.type === t
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            placeholder="Subject *"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            required
          />
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saveMut.isPending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {['open', 'completed', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
              status === s
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
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">No tasks yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border bg-white p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{a.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">
                    {a.type} · {a.status}
                    {a.due_at ? ` · due ${new Date(a.due_at).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
              {a.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.description}</p>
              )}
              {a.status !== 'completed' && a.status !== 'cancelled' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={completeMut.isPending}
                  onClick={async () => {
                    try {
                      await completeMut.mutateAsync({ id: a.id })
                      toast.success('Marked complete')
                    } catch {
                      toast.error('Could not complete task')
                    }
                  }}
                >
                  Complete
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
