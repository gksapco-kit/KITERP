import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  usePaymentFollowups, useSavePaymentFollowup, useDeletePaymentFollowup,
} from '@/hooks/useCrm'
import type { PaymentFollowup } from '@/api/crm'
import { Plus, Loader2, Banknote, Pencil, Trash2 } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const STATUSES = ['open', 'promised', 'partial', 'paid', 'cancelled']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const CHANNELS = ['call', 'email', 'sms', 'whatsapp', 'visit']

function money(n: number | string | null | undefined, currency = 'INR') {
  const v = Number(n || 0)
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${currency} ${v.toFixed(2)}`
  }
}

function FollowupForm({
  initial, onClose,
}: { initial?: PaymentFollowup | null; onClose: () => void }) {
  const save = useSavePaymentFollowup()
  const [form, setForm] = useState({
    party_name: initial?.party_name || '',
    party_phone: initial?.party_phone || '',
    party_email: initial?.party_email || '',
    amount_due: String(initial?.amount_due ?? ''),
    currency: initial?.currency || 'INR',
    invoice_ref: initial?.invoice_ref || '',
    due_date: initial?.due_date?.slice(0, 10) || '',
    next_followup_at: initial?.next_followup_at
      ? initial.next_followup_at.slice(0, 16)
      : '',
    channel: initial?.channel || 'call',
    priority: initial?.priority || 'normal',
    status: initial?.status || 'open',
    promise_date: initial?.promise_date?.slice(0, 10) || '',
    notes: initial?.notes || '',
  })

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(p => ({ ...p, [key]: val }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.party_name.trim()) {
      toast.error('Party name is required')
      return
    }
    const payload = {
      party_name: form.party_name.trim(),
      party_phone: form.party_phone.trim() || undefined,
      party_email: form.party_email.trim() || undefined,
      amount_due: form.amount_due ? Number(form.amount_due) : 0,
      currency: form.currency || 'INR',
      invoice_ref: form.invoice_ref.trim() || undefined,
      due_date: form.due_date || undefined,
      next_followup_at: form.next_followup_at
        ? new Date(form.next_followup_at).toISOString()
        : undefined,
      channel: form.channel,
      priority: form.priority,
      status: form.status,
      promise_date: form.promise_date || undefined,
      notes: form.notes.trim() || undefined,
    }
    save.mutate(
      { id: initial?.id, data: payload },
      {
        onSuccess: () => {
          toast.success(initial ? 'Follow-up updated' : 'Follow-up created')
          onClose()
        },
        onError: (err) => toast.error(extractApiError(err, 'Could not save follow-up')),
      },
    )
  }

  const formId = 'payment-followup-form'

  return (
    <CrmModal
      title={initial ? `Edit ${initial.number}` : 'New payment follow-up'}
      onClose={onClose}
      maxW="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {initial ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-2.5 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Party name" required>
            <Input value={form.party_name} onChange={e => set('party_name', e.target.value)} className="h-9" />
          </Field>
          <Field label="Invoice / ref">
            <Input value={form.invoice_ref} onChange={e => set('invoice_ref', e.target.value)} className="h-9" />
          </Field>
          <Field label="Phone">
            <Input value={form.party_phone} onChange={e => set('party_phone', e.target.value)} className="h-9" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.party_email} onChange={e => set('party_email', e.target.value)} className="h-9" />
          </Field>
          <Field label="Amount due">
            <Input type="number" min="0" step="0.01" value={form.amount_due} onChange={e => set('amount_due', e.target.value)} className="h-9" />
          </Field>
          <Field label="Currency">
            <Input value={form.currency} onChange={e => set('currency', e.target.value)} className="h-9" />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-9" />
          </Field>
          <Field label="Next follow-up">
            <Input type="datetime-local" value={form.next_followup_at} onChange={e => set('next_followup_at', e.target.value)} className="h-9" />
          </Field>
          <Field label="Channel">
            <Select value={form.channel} onChange={v => set('channel', v)} options={CHANNELS.map(c => ({ value: c, label: c }))} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={v => set('priority', v)} options={PRIORITIES.map(p => ({ value: p, label: p }))} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={v => set('status', v)} options={STATUSES.map(s => ({ value: s, label: s }))} />
          </Field>
          <Field label="Promise date">
            <Input type="date" value={form.promise_date} onChange={e => set('promise_date', e.target.value)} className="h-9" />
          </Field>
        </div>
        <Field label="Notes">
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Collection notes…" className="h-9" />
        </Field>
      </form>
    </CrmModal>
  )
}

export default function PaymentFollowupsPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('open')
  const [editing, setEditing] = useState<PaymentFollowup | null | undefined>(undefined)
  const { data, isLoading } = usePaymentFollowups({
    page, size: pageSize, q: search || undefined, status: status || undefined,
  })
  const del = useDeletePaymentFollowup()

  const remove = (row: PaymentFollowup) => {
    if (!window.confirm(`Delete follow-up ${row.number}?`)) return
    del.mutate(row.id, {
      onSuccess: () => toast.success('Follow-up deleted'),
      onError: (err) => toast.error(extractApiError(err, 'Could not delete')),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Payment Follow-ups</h1>
          <p className="text-sm text-gray-500 mt-1">Track overdue collections, promises, and next actions.</p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus className="w-4 h-4 mr-2" /> New follow-up
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', ...STATUSES].map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`text-xs px-3 py-1.5 rounded-full border ${status === s ? 'bg-primary text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search party, invoice, phone…"
      />

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Follow-up</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Amount</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Next</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell"><TableColumnLabel>Channel</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Action</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No payment follow-ups" action={
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                    <Banknote className="w-4 h-4 mr-1" /> Add follow-up
                  </Button>
                } />
              ) : data.items.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{row.number}</span>
                      <span className="truncate">{row.party_name}</span>
                    </p>
                    {row.invoice_ref && (
                      <p className="text-xs text-gray-500 mt-0.5">Inv: {row.invoice_ref}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm hidden md:table-cell">{money(row.amount_due, row.currency)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={row.status === 'paid' ? 'success' : row.status === 'cancelled' ? 'destructive' : row.priority === 'urgent' ? 'warning' : 'soft'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden lg:table-cell">
                    {row.next_followup_at ? formatDateTime(row.next_followup_at) : '—'}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden xl:table-cell">{row.channel}</td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(row)} disabled={del.isPending}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager
            page={page}
            pages={data?.pages || 0}
            total={data?.total || 0}
            onPage={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            itemLabel="follow-ups"
          />
        </CardContent>
      </Card>

      {editing !== undefined && (
        <FollowupForm initial={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}
