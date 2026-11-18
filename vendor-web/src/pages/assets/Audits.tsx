import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAm, useAmMutation, useAssetPerms, type Row } from './api'
import { CategorySelect, DataTable, Dialog, Field, Loading, LocationSelect, PageHeader, StatusBadge, StoreSelect, TextArea, fmtDate } from './ui'

export default function Audits() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const { data = [], isLoading } = useAm<Row[]>('/audits')
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Physical Audits" subtitle="Count what you really have, by scanning labels, and settle the differences."
        actions={perms.audit ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New audit</Button> : null} />
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No audits yet." onRow={(a) => nav(`/assets/audits/${a.id}`)}
          cols={[
            { key: 'audit_no', header: 'No.', render: (a) => <span className="font-mono font-semibold">{a.audit_no}</span> },
            { key: 'name', header: 'Audit', render: (a) => <span className="font-medium">{a.name}</span> },
            { key: 'status', header: 'Status', render: (a) => <StatusBadge value={a.status} /> },
            { key: 'progress', header: 'Progress', render: (a) => `${a.scanned} / ${a.total}` },
            { key: 'found', header: 'Found', render: (a) => a.found },
            { key: 'variance', header: 'Variance', render: (a) => {
              const v = (a.missing ?? 0) + (a.damaged ?? 0) + (a.wrong_location ?? 0)
              return v ? <span className="font-semibold text-red-600">{v}</span> : 0
            } },
            { key: 'planned_date', header: 'Planned', render: (a) => fmtDate(a.planned_date) },
          ]} />
      )}
      {open ? <CreateAudit onClose={() => setOpen(false)} onCreated={(id) => nav(`/assets/audits/${id}`)} /> : null}
    </div>
  )
}

function CreateAudit({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [loc, setLoc] = useState('')
  const [cat, setCat] = useState('')
  const [store, setStore] = useState('')
  const [when, setWhen] = useState('')
  const [notes, setNotes] = useState('')
  const m = useAmMutation({ success: 'Audit created', onSuccess: (r) => { onClose(); onCreated(r.id) } })
  return (
    <Dialog title="New audit" subtitle="Pick the scope. Every asset in scope becomes a line to be counted." onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending} onClick={() => {
          if (!name.trim()) return toast.error('Give the audit a name')
          m.mutate({ path: '/audits', body: { name: name.trim(), scope_location_id: loc || undefined, scope_category_id: cat || undefined, scope_store_id: store || undefined, planned_date: when || undefined, notes: notes || undefined } })
        }}>{m.isPending ? 'Creating…' : 'Create'}</Button></>}>
      <Field label="Name" required><Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Head office, Q4 count" /></Field>
      <Field label="Location" hint="Includes everything inside it."><LocationSelect value={loc} onChange={setLoc} blank="Whole company" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category"><CategorySelect value={cat} onChange={setCat} blank="All categories" /></Field>
        <Field label="Store"><StoreSelect value={store} onChange={setStore} blank="All stores" /></Field>
      </div>
      <Field label="Planned date"><Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Dialog>
  )
}
