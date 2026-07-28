import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import {
  useConvertPlatformLead,
  usePlatformLeads,
  useSavePlatformLead,
} from '@/hooks/usePlatformCrm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import CrmSubnav from './CrmSubnav'

const STATUSES = ['', 'new', 'contacted', 'qualified', 'unqualified', 'converted'] as const

export default function PlatformCrmLeads() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', notes: '' })

  const { data, isLoading } = usePlatformLeads({ status: status || undefined, size: 50 })
  const saveMut = useSavePlatformLead()
  const convertMut = useConvertPlatformLead()

  if (!allowed) return <Navigate to="/dashboard" replace />

  const items = data?.items ?? []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) {
      toast.error('First name is required')
      return
    }
    try {
      await saveMut.mutateAsync({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          notes: form.notes.trim() || undefined,
          source: 'manual',
          status: 'new',
        },
      })
      toast.success('Lead created')
      setForm({ first_name: '', last_name: '', email: '', phone: '', company: '', notes: '' })
      setShowForm(false)
    } catch {
      toast.error('Could not create lead')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Platform CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-600 mt-1">
            Platform Contact Us submissions land here as leads, plus any prospects you add manually.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Add lead
        </Button>
      </div>

      <CrmSubnav />

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid sm:grid-cols-2 gap-3">
          <Input
            placeholder="First name *"
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            required
          />
          <Input
            placeholder="Last name"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <PhoneInput
            value={form.phone}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            defaultCountryIso="IN"
            autoComplete="tel"
            name="phone"
            compact
          />
          <Input
            className="sm:col-span-2"
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          />
          <textarea
            className="sm:col-span-2 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="sm" disabled={saveMut.isPending}>
              Save lead
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
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
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">No leads yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((lead) => (
            <div key={lead.id} className="rounded-xl border bg-white p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">
                    {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'}
                    {lead.company ? (
                      <span className="font-normal text-gray-500"> · {lead.company}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lead.number} · {lead.source || '—'} ·{' '}
                    {lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}
                  </p>
                </div>
                <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 h-fit">
                  {lead.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                {lead.email && <span>{lead.email}</span>}
                {lead.phone && <span>{lead.phone}</span>}
              </div>
              {lead.notes && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap border-t pt-2">{lead.notes}</p>
              )}
              {lead.status !== 'converted' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={convertMut.isPending}
                  onClick={async () => {
                    try {
                      await convertMut.mutateAsync({ id: lead.id, payload: { create_deal: true } })
                      toast.success('Lead converted to contact + deal')
                    } catch (err: unknown) {
                      const detail = (err as { response?: { data?: { detail?: unknown; message?: string } } })
                        ?.response?.data
                      const msg =
                        (typeof detail?.detail === 'string' && detail.detail) ||
                        (typeof detail?.detail === 'object' &&
                          detail?.detail &&
                          'message' in detail.detail &&
                          String((detail.detail as { message?: string }).message)) ||
                        detail?.message ||
                        'Could not convert lead'
                      toast.error(msg)
                    }
                  }}
                >
                  Convert
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
