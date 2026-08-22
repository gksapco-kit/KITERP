import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import {
  useConvertPlatformLead,
  useDeletePlatformLead,
  usePlatformLeads,
  useRestorePlatformLead,
  useSavePlatformLead,
} from '@/hooks/usePlatformCrm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import CrmSubnav from './CrmSubnav'

const STATUSES = ['', 'new', 'contacted', 'qualified', 'unqualified', 'converted'] as const

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  source: 'website',
  notes: '',
}

const SOURCE_LABELS: Record<string, string> = {
  talk_to_us: 'Talk to us',
  platform_contact: 'Talk to us',
  website: 'Website',
  ads: 'Ads',
  referral: 'Referral',
  other: 'Other',
  manual: 'Manual',
}

function sourceLabel(source?: string | null) {
  const key = (source || '').trim().toLowerCase().replace(/\s+/g, '_')
  return SOURCE_LABELS[key] || source || '—'
}

function leadName(lead: { first_name?: string | null; last_name?: string | null }) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'
}

const CELL_PREVIEW_CHARS = 20

function previewText(value?: string | null, maxChars = CELL_PREVIEW_CHARS) {
  const text = (value || '').trim()
  if (!text) return { display: '—', full: '' }
  if (text.length <= maxChars) return { display: text, full: text }
  return { display: `${text.slice(0, maxChars)}…`, full: text }
}

function TextPreview({ value, className }: { value?: string | null; className?: string }) {
  const { display, full } = previewText(value)
  if (!full) return <span className={className}>—</span>
  return (
    <span className={className} title={full}>
      {display}
    </span>
  )
}

export default function PlatformCrmLeads() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data, isLoading } = usePlatformLeads({
    status: showDeleted ? undefined : (status || undefined),
    size: 50,
    deleted: showDeleted,
  })
  const { data: trashPage } = usePlatformLeads({ deleted: true, size: 1, page: 1 })
  const saveMut = useSavePlatformLead()
  const convertMut = useConvertPlatformLead()
  const deleteMut = useDeletePlatformLead()
  const restoreMut = useRestorePlatformLead()
  const trashCount = trashPage?.total ?? 0

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
          title: form.title.trim() || undefined,
          company: form.company.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
          source: form.source || 'manual',
          status: 'new',
        },
      })
      toast.success('Lead created')
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch {
      toast.error('Could not create lead')
    }
  }

  const convert = async (id: string) => {
    try {
      await convertMut.mutateAsync({ id, payload: { create_deal: true } })
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
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Platform CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">{showDeleted ? 'Deleted leads' : 'Leads'}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {showDeleted
              ? 'Restore a lead to put it back on the active list.'
              : 'Talk to us, Add new lead, and Contact Us submissions land here — name, title, company, phone, source, and message included.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showDeleted ? 'default' : 'outline'}
            onClick={() => { setShowDeleted((v) => !v); setStatus(''); setShowForm(false) }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {showDeleted ? 'Back to leads' : 'Deleted leads'}
            {!showDeleted && trashCount > 0 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{trashCount}</span>
            ) : null}
          </Button>
          {!showDeleted ? (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" />
              Add lead
            </Button>
          ) : null}
        </div>
      </div>

      <CrmSubnav />

      {showDeleted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          These leads were moved to trash. Restore a record to put it back on the active list.
        </div>
      ) : null}

      {showForm && !showDeleted && (
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
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
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
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
          >
            <option value="website">Website</option>
            <option value="talk_to_us">Talk to us</option>
            <option value="ads">Ads</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
            <option value="manual">Manual</option>
          </select>
          <textarea
            className="sm:col-span-2 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Notes / message"
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

      {!showDeleted ? (
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
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">
          {showDeleted ? 'No deleted leads.' : 'No leads yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[64rem]">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-1.5">Lead</th>
                <th className="px-4 py-1.5">Name</th>
                <th className="px-4 py-1.5">Email</th>
                <th className="px-4 py-1.5">Phone</th>
                <th className="px-4 py-1.5">Status</th>
                <th className="px-4 py-1.5">Title</th>
                <th className="px-4 py-1.5">Company</th>
                <th className="px-4 py-1.5">Source</th>
                <th className="px-4 py-1.5">Note</th>
                <th className="px-4 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((lead) => (
                <tr key={lead.id} className="align-middle hover:bg-gray-50">
                  <td className="px-4 py-1.5">
                    <p className="text-sm font-medium leading-5 text-gray-900">
                      <TextPreview value={lead.number} />
                    </p>
                    <p className="whitespace-nowrap text-xs leading-4 text-gray-500">
                      {lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-1.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                    <TextPreview value={leadName(lead) === '—' ? '' : leadName(lead)} />
                  </td>
                  <td className="px-4 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                    <TextPreview value={lead.email} />
                  </td>
                  <td className="px-4 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                    <TextPreview value={lead.phone} />
                  </td>
                  <td className="px-4 py-1.5">
                    <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                      {lead.status || 'new'}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                    <TextPreview value={lead.title} />
                  </td>
                  <td className="px-4 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                    <TextPreview value={lead.company} />
                  </td>
                  <td className="px-4 py-1.5 whitespace-nowrap">
                    {lead.source ? (
                      <span
                        title={sourceLabel(lead.source)}
                        className="inline-flex max-w-[14rem] min-w-0 truncate whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800"
                      >
                        {previewText(sourceLabel(lead.source)).display}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                    <TextPreview value={lead.notes} />
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <div className="flex justify-end gap-2">
                      {showDeleted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoreMut.isPending}
                          onClick={async () => {
                            try {
                              await restoreMut.mutateAsync(lead.id)
                              toast.success('Lead restored')
                            } catch {
                              toast.error('Could not restore lead')
                            }
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          {lead.status !== 'converted' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={convertMut.isPending}
                              onClick={() => void convert(lead.id)}
                            >
                              Convert
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400 self-center">Converted</span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deleteMut.isPending}
                            onClick={async () => {
                              if (!window.confirm('Move this lead to trash? You can restore it later.')) return
                              try {
                                await deleteMut.mutateAsync(lead.id)
                                toast.success('Lead moved to trash')
                              } catch {
                                toast.error('Could not delete lead')
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
