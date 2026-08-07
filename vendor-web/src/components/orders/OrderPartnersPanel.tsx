/**
 * OrderPartnersPanel — Phase-6
 *
 * Displays and edits the named parties (partner functions) on an order:
 *   buyer     — who placed the order (auto-seeded; read-only here)
 *   ship_to   — delivery contact / address
 *   bill_to   — invoice recipient
 *   payer     — party responsible for payment
 *   contact   — additional contact person
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, Plus, Pencil, Trash2, Loader2, X, Building2, User, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import type { Order, OrderPartner } from '@/types'

interface Props {
  order: Order
  isTerminal: boolean
}

// ── Role metadata ────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; badgeCls: string; description: string }> = {
  buyer:   { label: 'Buyer',           badgeCls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',     description: 'Placed the order' },
  ship_to: { label: 'Ship-To',         badgeCls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300', description: 'Delivery address / contact' },
  bill_to: { label: 'Bill-To',         badgeCls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',  description: 'Invoice recipient' },
  payer:   { label: 'Payer',           badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', description: 'Responsible for payment' },
  contact: { label: 'Contact',         badgeCls: 'bg-muted text-muted-foreground',                                         description: 'Additional contact' },
  other:   { label: 'Other',           badgeCls: 'bg-muted text-muted-foreground',                                         description: '' },
}

const ADDABLE_ROLES = ['ship_to', 'bill_to', 'payer', 'contact']

// ── Edit form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  orderId: string
  role: string
  initial?: OrderPartner
  onClose: () => void
}

function EditPartnerForm({ orderId, role, initial, onClose }: EditFormProps) {
  const qc = useQueryClient()
  const meta = ROLE_META[role] || { label: role, badgeCls: '', description: '' }

  const [form, setForm] = useState({
    contact_name: initial?.contact_name || '',
    contact_email: initial?.contact_email || '',
    contact_phone: initial?.contact_phone || '',
    company_name: initial?.company_name || '',
    gstin: initial?.gstin || '',
    notes: initial?.notes || '',
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      vendorApi.upsertOrderPartner(orderId, role, {
        contact_name: form.contact_name || undefined,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
        company_name: form.company_name || undefined,
        gstin: form.gstin || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(`${meta.label} partner saved`)
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not save partner'
      toast.error(msg)
    },
  })

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">{initial ? 'Edit' : 'Add'} {meta.label}</h2>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <Label className="text-xs">Contact Name</Label>
            <Input value={form.contact_name} onChange={upd('contact_name')} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.contact_email} onChange={upd('contact_email')} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={form.contact_phone} onChange={upd('contact_phone')} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Company</Label>
            <Input value={form.company_name} onChange={upd('company_name')} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">GSTIN</Label>
            <Input value={form.gstin} onChange={upd('gstin')} placeholder="Optional" className="h-8 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={upd('notes')} className="h-8 text-sm mt-1" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={() => mutate()} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Single partner card ───────────────────────────────────────────────────────

function PartnerCard({
  partner,
  orderId,
  isTerminal,
}: {
  partner: OrderPartner
  orderId: string
  isTerminal: boolean
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const meta = ROLE_META[partner.role] || { label: partner.role, badgeCls: '', description: '' }

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: () => vendorApi.deleteOrderPartner(orderId, partner.role),
    onSuccess: () => {
      toast.success('Partner removed')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
    },
    onError: () => toast.error('Could not remove partner'),
  })

  const isReadOnly = partner.role === 'buyer' || isTerminal

  return (
    <>
      <div className="rounded-lg border border-border bg-background px-3 py-2.5 flex gap-3">
        <div className="mt-0.5 shrink-0">
          {partner.company_name ? (
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <Badge className={cn('text-[10px] px-1.5 py-0', meta.badgeCls)}>{meta.label}</Badge>
            {partner.company_name && (
              <span className="text-[12px] font-medium truncate">{partner.company_name}</span>
            )}
            {partner.contact_name && (
              <span className="text-[12px] truncate text-muted-foreground">{partner.contact_name}</span>
            )}
            {partner.gstin && (
              <span className="text-[10px] text-muted-foreground">GSTIN: {partner.gstin}</span>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            {partner.contact_email && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Mail className="h-3 w-3" />{partner.contact_email}
              </span>
            )}
            {partner.contact_phone && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Phone className="h-3 w-3" />{partner.contact_phone}
              </span>
            )}
          </div>
          {partner.notes && (
            <p className="text-[11px] italic text-muted-foreground mt-0.5">{partner.notes}</p>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex items-start gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {partner.role !== 'buyer' && (
              <button
                onClick={() => remove()}
                disabled={removing}
                className="p-1 text-muted-foreground hover:text-destructive rounded"
                title="Remove"
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <EditPartnerForm
          orderId={orderId}
          role={partner.role}
          initial={partner}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function OrderPartnersPanel({ order, isTerminal }: Props) {
  const [addRole, setAddRole] = useState<string | null>(null)
  const partners = order.partners ?? []
  const existingRoles = new Set(partners.map((p) => p.role))
  const availableToAdd = ADDABLE_ROLES.filter((r) => !existingRoles.has(r))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Partners</span>
          {partners.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{partners.length}</Badge>
          )}
        </div>
        {!isTerminal && availableToAdd.length > 0 && (
          <div className="relative">
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none cursor-pointer"
              value=""
              onChange={(e) => { if (e.target.value) setAddRole(e.target.value) }}
            >
              <option value="">+ Add party</option>
              {availableToAdd.map((r) => (
                <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        {partners.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">No partner information yet.</p>
        ) : (
          partners.map((p) => (
            <PartnerCard key={p.id} partner={p} orderId={order.id} isTerminal={isTerminal} />
          ))
        )}
      </div>

      {addRole && (
        <EditPartnerForm
          orderId={order.id}
          role={addRole}
          onClose={() => setAddRole(null)}
        />
      )}
    </div>
  )
}
