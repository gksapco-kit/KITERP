import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import { usePlatformContacts, useSavePlatformContact } from '@/hooks/usePlatformCrm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CrmSubnav from './CrmSubnav'

export default function PlatformCrmContacts() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    title: '',
    record_type: 'person' as 'person' | 'company',
  })

  const { data, isLoading } = usePlatformContacts({ q: q || undefined, size: 50 })
  const saveMut = useSavePlatformContact()

  if (!allowed) return <Navigate to="/dashboard" replace />

  const items = data?.items ?? []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      await saveMut.mutateAsync({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          title: form.title.trim() || undefined,
          record_type: form.record_type,
          lead_source: 'manual',
        },
      })
      toast.success('Contact saved')
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        title: '',
        record_type: 'person',
      })
      setShowForm(false)
    } catch {
      toast.error('Could not save contact')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Platform CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-600 mt-1">People and companies in the KIT ERP sales CRM.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Add contact
        </Button>
      </div>

      <CrmSubnav />

      <Input
        placeholder="Search contacts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex gap-2">
            {(['person', 'company'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, record_type: t }))}
                className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                  form.record_type === t
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            placeholder={form.record_type === 'company' ? 'Company name *' : 'First name *'}
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            required
          />
          {form.record_type === 'person' && (
            <Input
              placeholder="Last name"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
          )}
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Title / role"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="sm" disabled={saveMut.isPending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">No contacts yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">
                    {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">
                    {c.record_type || 'person'}
                    {c.title ? ` · ${c.title}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
                {c.email && <span>{c.email}</span>}
                {c.phone && <span>{c.phone}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
