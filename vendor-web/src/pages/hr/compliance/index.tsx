import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Trash2, X, Pencil, Send, FileText, ShieldCheck, Award, Activity, Download, ExternalLink,
} from 'lucide-react'
import {
  useHRPolicies, useCreateHRPolicy, useUpdateHRPolicy, usePublishHRPolicy, useDeleteHRPolicy,
  useHRCertifications, useCreateHRCertification, useUpdateHRCertification, useDeleteHRCertification,
  useHRAuditLogs, useHREmployees,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { Policy, ComplianceCertification, ComplianceAuditLog, EmployeeProfile } from '@/types'

import { askConfirm } from '@/components/common/ConfirmProvider'

const denseFieldClass =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const denseLabelClass = 'mb-0.5 block text-[11px] font-medium text-muted-foreground'
const denseTextareaClass =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none'

type Tab = 'policies' | 'certifications' | 'audit'

const POLICY_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-muted text-muted-foreground' },
  published: { label: 'Published', color: 'bg-primary/15 text-primary' },
  archived:  { label: 'Archived',  color: 'bg-muted text-muted-foreground' },
}

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('policies')
  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Compliance</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Policies, certifications, and audit trail
        </p>
      </div>
      <div className="flex gap-1 border-b border-border">
        {[
          { k: 'policies',       label: 'Policies',       icon: ShieldCheck },
          { k: 'certifications', label: 'Certifications', icon: Award },
          { k: 'audit',          label: 'Audit Logs',     icon: Activity },
        ].map(t => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k as Tab)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.k
                ? 'border-b-2 border-primary text-primary'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'policies' && <PoliciesTab />}
      {tab === 'certifications' && <CertificationsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

function PoliciesTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: policies = [], isLoading } = useHRPolicies(statusFilter || undefined)
  const publish = usePublishHRPolicy()
  const del = useDeleteHRPolicy()
  const [editing, setEditing] = useState<Policy | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          aria-label="Filter by status"
          className="h-8 text-sm"
          triggerClassName="h-8"
          wrapperClassName="w-[11rem] shrink-0"
          menuMinWidth={160}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Policy
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (policies as Policy[]).length === 0 ? (
          <div className="px-4 py-10 text-center">
            <ShieldCheck className="mx-auto mb-2 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No policies yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {['Title', 'Category', 'Version', 'Effective', 'Status', 'Acks', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(policies as Policy[]).map(p => {
                  const cfg = POLICY_STATUS[p.status] ?? POLICY_STATUS.draft
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <Link to={`/hr/compliance/policies/${p.id}`} className="font-medium text-primary hover:underline">
                          {p.title}
                        </Link>
                        {p.summary && <p className="line-clamp-1 text-xs text-muted-foreground">{p.summary}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.category ?? '—'}</td>
                      <td className="px-3 py-2.5 text-foreground">v{p.version}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {p.effective_from ?? '—'}
                        {p.expires_on && <span className="text-muted-foreground/70"> → {p.expires_on}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cfg.color)}>{cfg.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.acknowledgements?.length ?? 0}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <Link
                            to={`/hr/compliance/policies/${p.id}`}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            title="Open"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          {p.status === 'draft' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditing(p)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (await askConfirm('Publish this policy? Employees will be asked to acknowledge.')) {
                                    publish.mutate(p.id)
                                  }
                                }}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                title="Publish"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (await askConfirm('Delete this policy?')) del.mutate(p.id)
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(showNew || editing) && (
        <PolicyModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function PolicyModal({
 existing, onClose }: { existing?: Policy | null; onClose: () => void }) {
  const create = useCreateHRPolicy()
  const update = useUpdateHRPolicy()
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    category: existing?.category ?? '',
    summary: existing?.summary ?? '',
    body: existing?.body ?? '',
    effective_from: existing?.effective_from ?? '',
    expires_on: existing?.expires_on ?? '',
    requires_acknowledgement: existing?.requires_acknowledgement ?? true,
    audience: existing?.audience ?? 'all',
    attachment_url: existing?.attachment_url ?? '',
  })
  const [bumpVersion, setBumpVersion] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      effective_from: form.effective_from || null,
      expires_on: form.expires_on || null,
      attachment_url: form.attachment_url || null,
    }
    if (existing) await update.mutateAsync({ id: existing.id, data: payload, bumpVersion })
    else await create.mutateAsync(payload)
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-h-[calc(100dvh-1.5rem)] max-w-2xl !rounded-lg overflow-hidden">
        <ModalHeader
          title={existing ? `Edit Policy (v${existing.version})` : 'New Policy'}
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
        />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2 overflow-y-auto px-4 pb-1 pt-0">
            <div>
              <Label className={denseLabelClass} required>Title</Label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className={denseFieldClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className={denseLabelClass}>Category</Label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className={denseFieldClass} placeholder="e.g. Code of Conduct" />
              </div>
              <div>
                <Label className={denseLabelClass}>Audience</Label>
                <Select
                  value={form.audience}
                  onChange={v => setForm({ ...form, audience: v })}
                  className={denseFieldClass}
                  options={[
                    { value: 'all', label: 'All employees' },
                    { value: 'department', label: 'Specific department' },
                    { value: 'designation', label: 'Specific designation' },
                  ]}
                />
              </div>
              <div>
                <Label className={denseLabelClass}>Effective From</Label>
                <input type="date" value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })}
                  className={denseFieldClass} />
              </div>
              <div>
                <Label className={denseLabelClass}>Expires On</Label>
                <input type="date" value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })}
                  className={denseFieldClass} />
              </div>
            </div>
            <div>
              <Label className={denseLabelClass}>Summary</Label>
              <textarea rows={2} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
                className={denseTextareaClass} placeholder="Short overview…" />
            </div>
            <div>
              <Label className={denseLabelClass}>Body (HTML/Markdown)</Label>
              <textarea rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                className={cn(denseTextareaClass, 'font-mono text-xs')} />
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <div>
                <Label className={denseLabelClass}>Attachment URL</Label>
                <input value={form.attachment_url} onChange={e => setForm({ ...form, attachment_url: e.target.value })}
                  className={denseFieldClass} placeholder="https://…" />
              </div>
              <label className="mb-1 flex h-8 items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
                <input type="checkbox" checked={form.requires_acknowledgement}
                  onChange={e => setForm({ ...form, requires_acknowledgement: e.target.checked })} />
                Requires acknowledgement
              </label>
            </div>
            {existing && existing.status === 'published' && (
              <label className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                <input type="checkbox" checked={bumpVersion} onChange={e => setBumpVersion(e.target.checked)} />
                Bump version (clears acknowledgements, requires re-ack)
              </label>
            )}
          </ModalBody>
          <ModalFooter className="border-0 px-4 py-2.5">
            <button type="button" onClick={onClose} className="btn-cancel h-8 rounded-md border border-border px-3 text-sm">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending}
              className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {create.isPending || update.isPending ? 'Saving…' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

function CertificationsTab() {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [expiringDays, setExpiringDays] = useState('')
  const params: { employee_id?: string; expiring_within_days?: number } = {}
  if (employeeFilter) params.employee_id = employeeFilter
  if (expiringDays) params.expiring_within_days = Number(expiringDays)
  const { data: certs = [], isLoading } = useHRCertifications(params)
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const empMap = new Map((employees as EmployeeProfile[]).map(e => [e.id, e.vendor_user?.user?.full_name ?? e.employee_code]))
  const del = useDeleteHRCertification()
  const [editing, setEditing] = useState<ComplianceCertification | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select
            value={employeeFilter}
            onChange={setEmployeeFilter}
            aria-label="Filter by employee"
            className="h-8 text-sm"
            triggerClassName="h-8"
            wrapperClassName="w-[12rem] shrink-0"
            menuMinWidth={180}
            options={[
              { value: '', label: 'All employees' },
              ...(employees as EmployeeProfile[]).map(e => ({
                value: e.id,
                label: e.vendor_user?.user?.full_name ?? e.employee_code ?? '',
              })),
            ]}
          />
          <Select
            value={expiringDays}
            onChange={setExpiringDays}
            aria-label="Filter by expiry"
            className="h-8 text-sm"
            triggerClassName="h-8"
            wrapperClassName="w-[13rem] shrink-0"
            menuMinWidth={200}
            options={[
              { value: '', label: 'Any expiry' },
              { value: '30', label: 'Expiring in 30 days' },
              { value: '90', label: 'Expiring in 90 days' },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Certification
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (certs as ComplianceCertification[]).length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Award className="mx-auto mb-2 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No certifications.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {['Employee', 'Certification', 'Type', 'Issued By', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(certs as ComplianceCertification[]).map(c => {
                  const expiresSoon = c.expires_on && new Date(c.expires_on) < new Date(Date.now() + 30 * 86400000)
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2.5">{empMap.get(c.employee_id) ?? c.employee_id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{c.name}</p>
                        {c.cert_number && <p className="text-xs text-muted-foreground">#{c.cert_number}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.type ?? '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.issued_by ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.issued_on ?? '—'}</td>
                      <td className={cn('px-3 py-2.5 text-xs', expiresSoon ? 'font-semibold text-red-600' : 'text-muted-foreground')}>
                        {c.expires_on ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          c.status === 'active' ? 'bg-primary/15 text-primary'
                            : c.status === 'expired' ? 'bg-red-100 text-red-700'
                              : 'bg-muted text-muted-foreground',
                        )}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setEditing(c)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (await askConfirm('Delete certification?')) del.mutate(c.id)
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(showNew || editing) && (
        <CertModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function CertModal({
 existing, onClose }: { existing?: ComplianceCertification | null; onClose: () => void }) {
  const { data: empData } = useHREmployees({ limit: 200 })
  const employees: EmployeeProfile[] = empData?.items ?? []
  const create = useCreateHRCertification()
  const update = useUpdateHRCertification()
  const [form, setForm] = useState({
    employee_id: existing?.employee_id ?? '',
    name: existing?.name ?? '',
    type: existing?.type ?? '',
    issued_by: existing?.issued_by ?? '',
    cert_number: existing?.cert_number ?? '',
    issued_on: existing?.issued_on ?? '',
    expires_on: existing?.expires_on ?? '',
    document_url: existing?.document_url ?? '',
    notes: existing?.notes ?? '',
    status: existing?.status ?? 'active',
  })
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      issued_on: form.issued_on || null,
      expires_on: form.expires_on || null,
      document_url: form.document_url || null,
    }
    if (existing) await update.mutateAsync({ id: existing.id, data: payload })
    else await create.mutateAsync(payload)
    onClose()
  }
  return (
    <div data-kiterp-modal className={dialogOverlayClass}>
      <div className={cn(dialogPanelClass, 'max-w-md')}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Certification' : 'New Certification'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 p-5">
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase" required>Employee</Label>
            <Select
              value={form.employee_id}
              onChange={v => setForm({ ...form, employee_id: v })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              options={[
                { value: '', label: '— Select —' },
                ...(employees as EmployeeProfile[]).map(e => ({
                  value: e.id,
                  label: e.vendor_user?.user?.full_name ?? e.employee_code ?? '',
                })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase" required>Certification Name</Label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Type</Label>
              <input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                placeholder="license / training / etc."
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Issued By</Label>
              <input value={form.issued_by} onChange={e => setForm({ ...form, issued_by: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Cert Number</Label>
              <input value={form.cert_number} onChange={e => setForm({ ...form, cert_number: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Issued On</Label>
              <input type="date" value={form.issued_on} onChange={e => setForm({ ...form, issued_on: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase">Expires On</Label>
              <input type="date" value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Document URL</Label>
            <input value={form.document_url} onChange={e => setForm({ ...form, document_url: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Notes</Label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase">Status</Label>
            <Select
              value={form.status}
              onChange={v => setForm({ ...form, status: v as ComplianceCertification['status'] })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'revoked', label: 'Revoked' },
              ]}
            />
          </div>
          </div>
          <div className="shrink-0 flex justify-end gap-2 border-t px-5 py-3">
            <button type="button" onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {create.isPending || update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AuditTab() {
  const [entityType, setEntityType] = useState('')
  const params: { entity_type?: string; limit?: number } = { limit: 200 }
  if (entityType) params.entity_type = entityType
  const { data: logs = [], isLoading } = useHRAuditLogs(params)

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={entityType}
          onChange={setEntityType}
          aria-label="Filter by entity type"
          className="h-8 text-sm"
          triggerClassName="h-8"
          wrapperClassName="w-[12rem] shrink-0"
          menuMinWidth={180}
          options={[
            { value: '', label: 'All entity types' },
            { value: 'policy', label: 'Policy' },
            { value: 'job_posting', label: 'Job Posting' },
            { value: 'application', label: 'Application' },
            { value: 'review_cycle', label: 'Review Cycle' },
            { value: 'performance_review', label: 'Performance Review' },
            { value: 'training_program', label: 'Training Program' },
            { value: 'announcement', label: 'Announcement' },
            { value: 'expense_claim', label: 'Expense Claim' },
          ]}
        />
        <button
          type="button"
          onClick={vendorApi.hrDownloadAuditCsv}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (logs as ComplianceAuditLog[]).length === 0 ? (
          <div className="px-4 py-10 text-center">
            <FileText className="mx-auto mb-2 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No audit logs.</p>
          </div>
        ) : (
          <div className="max-h-[min(70vh,40rem)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted/40">
                <tr>
                  {['When', 'Actor', 'Action', 'Entity', 'Summary'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(logs as ComplianceAuditLog[]).map(l => (
                  <tr key={l.id} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground">
                      {l.actor_label ?? l.actor_user_id?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">{l.action}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.entity_type}
                      {l.entity_id && <span className="text-muted-foreground/70"> #{l.entity_id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-3 py-2 text-foreground">{l.summary ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
