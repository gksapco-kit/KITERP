import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  useCreditControls, useSaveCreditControl, useDeleteCreditControl, useCheckCreditControl,
} from '@/hooks/useCrm'
import { useCustomers } from '@/hooks/useVendor'
import type { CreditControl } from '@/api/crm'
import { Plus, Loader2, ShieldCheck, Pencil, Trash2, Search } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const STATUSES = ['active', 'watch', 'blocked']

function money(n: number | string | null | undefined) {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v)
}

function CreditForm({
  initial, onClose,
}: { initial?: CreditControl | null; onClose: () => void }) {
  const save = useSaveCreditControl()
  const { data: customerData } = useCustomers({ limit: 200 })
  const customers = customerData?.items ?? []
  const [form, setForm] = useState({
    party_name: initial?.party_name || '',
    party_phone: initial?.party_phone || '',
    party_email: initial?.party_email || '',
    customer_id: initial?.customer_id || '',
    credit_limit: String(initial?.credit_limit ?? '10000'),
    max_payment_amount: String(initial?.max_payment_amount ?? '0'),
    current_outstanding: String(initial?.current_outstanding ?? '0'),
    payment_terms_days: String(initial?.payment_terms_days ?? 30),
    payment_blocked: initial?.payment_blocked ?? false,
    block_reason: initial?.block_reason || '',
    status: initial?.status || 'active',
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
      customer_id: form.customer_id.trim() || undefined,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : 0,
      max_payment_amount: form.max_payment_amount ? Number(form.max_payment_amount) : 0,
      current_outstanding: form.current_outstanding ? Number(form.current_outstanding) : 0,
      payment_terms_days: form.payment_terms_days ? Number(form.payment_terms_days) : 30,
      payment_blocked: form.payment_blocked,
      block_reason: form.block_reason.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    }
    save.mutate(
      { id: initial?.id, data: payload },
      {
        onSuccess: () => {
          toast.success(initial ? 'Credit control updated' : 'Credit control created')
          onClose()
        },
        onError: (err) => toast.error(extractApiError(err, 'Could not save credit control')),
      },
    )
  }

  const formId = 'credit-control-form'

  return (
    <CrmModal
      title={initial ? `Edit credit — ${initial.party_name}` : 'New credit control'}
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
          <Field label="Link customer (outlet)">
            <Select
              value={form.customer_id || '__none__'}
              onChange={v => {
                if (v === '__none__') {
                  set('customer_id', '')
                  return
                }
                const c = customers.find(x => x.id === v)
                if (!c) return
                setForm(p => ({
                  ...p,
                  customer_id: c.id,
                  party_name: c.full_name || p.party_name,
                  party_phone: c.phone || p.party_phone,
                  party_email: c.email || p.party_email,
                }))
              }}
              options={[
                { value: '__none__', label: 'No customer link / type party…' },
                ...customers.map(c => ({
                  value: c.id,
                  label: c.full_name + (c.phone ? ` · ${c.phone}` : ''),
                })),
              ]}
            />
          </Field>
          <Field label="Party name" required>
            <Input value={form.party_name} onChange={e => set('party_name', e.target.value)} className="h-9" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={v => set('status', v)} options={STATUSES.map(s => ({ value: s, label: s }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.party_phone} onChange={e => set('party_phone', e.target.value)} className="h-9" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.party_email} onChange={e => set('party_email', e.target.value)} className="h-9" />
          </Field>
          <Field label="Credit limit (max outstanding)">
            <Input type="number" min="0" step="0.01" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} className="h-9" />
          </Field>
          <Field label="Max payment amount">
            <Input type="number" min="0" step="0.01" value={form.max_payment_amount} onChange={e => set('max_payment_amount', e.target.value)} className="h-9" placeholder="Per invoice / payment cap" />
          </Field>
          <Field label="Current outstanding">
            <Input type="number" min="0" step="0.01" value={form.current_outstanding} onChange={e => set('current_outstanding', e.target.value)} className="h-9" />
          </Field>
          <Field label="Payment terms (days)">
            <Input type="number" min="0" value={form.payment_terms_days} onChange={e => set('payment_terms_days', e.target.value)} className="h-9" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input
            type="checkbox"
            checked={form.payment_blocked}
            onChange={e => set('payment_blocked', e.target.checked)}
            className="rounded border-gray-300"
          />
          Block payments for this party
        </label>
        {form.payment_blocked && (
          <Field label="Block reason">
            <Input value={form.block_reason} onChange={e => set('block_reason', e.target.value)} className="h-9" />
          </Field>
        )}
        <Field label="Notes">
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} className="h-9" />
        </Field>
      </form>
    </CrmModal>
  )
}

function CheckPanel() {
  const check = useCheckCreditControl()
  const [party, setParty] = useState('')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const run = () => {
    if (!party.trim() || !amount) {
      toast.error('Enter party name and amount')
      return
    }
    check.mutate(
      { party_name: party.trim(), amount: Number(amount) },
      {
        onSuccess: (res) => {
          setResult(res.allowed
            ? `Allowed — ${res.reason || 'within limits'}`
            : `Blocked — ${res.reason || 'not allowed'}`)
          if (res.allowed) toast.success('Payment allowed')
          else toast.error(res.reason || 'Payment not allowed')
        },
        onError: (err) => toast.error(extractApiError(err, 'Check failed')),
      },
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-medium text-gray-900">Check max payment / credit</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input placeholder="Party name" value={party} onChange={e => setParty(e.target.value)} className="h-9" />
          <Input type="number" min="0" step="0.01" placeholder="Proposed amount" value={amount} onChange={e => setAmount(e.target.value)} className="h-9" />
          <Button onClick={run} disabled={check.isPending}>
            {check.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Validate
          </Button>
        </div>
        {result && (
          <p className={`text-sm ${result.startsWith('Allowed') ? 'text-emerald-700' : 'text-red-600'}`}>{result}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function CreditControlPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<CreditControl | null | undefined>(undefined)
  const { data, isLoading } = useCreditControls({
    page, size: pageSize, q: search || undefined, status: status || undefined,
  })
  const del = useDeleteCreditControl()

  const remove = (row: CreditControl) => {
    if (!window.confirm(`Delete credit control for ${row.party_name}?`)) return
    del.mutate(row.id, {
      onSuccess: () => toast.success('Credit control deleted'),
      onError: (err) => toast.error(extractApiError(err, 'Could not delete')),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Credit Control</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set credit limits and max payment amounts per customer.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus className="w-4 h-4 mr-2" /> Add party
        </Button>
      </div>

      <CheckPanel />

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
        placeholder="Search party…"
      />

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Party</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Credit limit</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Max payment</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell"><TableColumnLabel>Outstanding</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Action</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No credit controls" action={
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                    <ShieldCheck className="w-4 h-4 mr-1" /> Add party
                  </Button>
                } />
              ) : data.items.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{row.party_name}</p>
                    {row.payment_blocked && (
                      <p className="text-xs text-red-600 mt-0.5">Payments blocked</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm hidden md:table-cell">{money(row.credit_limit)}</td>
                  <td className="px-6 py-4 text-sm hidden lg:table-cell">{money(row.max_payment_amount)}</td>
                  <td className="px-6 py-4 text-sm hidden xl:table-cell">
                    <span className={row.over_limit ? 'text-red-600 font-medium' : ''}>
                      {money(row.current_outstanding)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={row.status === 'blocked' ? 'destructive' : row.status === 'watch' ? 'warning' : 'success'}>
                      {row.status}
                    </Badge>
                  </td>
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
            itemLabel="parties"
          />
        </CardContent>
      </Card>

      {editing !== undefined && (
        <CreditForm initial={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}
