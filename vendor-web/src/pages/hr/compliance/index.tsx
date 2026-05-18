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

type Tab = 'policies' | 'certifications' | 'audit'

const POLICY_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  published: { label: 'Published', color: 'bg-green-100 text-green-700' },
  archived:  { label: 'Archived',  color: 'bg-gray-200 text-gray-700' },
}

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('policies')
  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="text-sm text-gray-500 mt-1">Policies, certifications and audit trail</p>
      </div>
      <div className="flex border-b mb-5 gap-1">
        {[
          { k: 'policies',       label: 'Policies',       icon: ShieldCheck },
          { k: 'certifications', label: 'Certifications', icon: Award },
          { k: 'audit',          label: 'Audit Logs',     icon: Activity },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as Tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
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
    <div>
      <div className="flex items-center justify-between mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Policy
        </button>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (policies as Policy[]).length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No policies yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['Title', 'Category', 'Version', 'Effective', 'Status', 'Acks', 'Actions'].map(h =>
                <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(policies as Policy[]).map(p => {
                const cfg = POLICY_STATUS[p.status] ?? POLICY_STATUS.draft
                return (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link to={`/hr/compliance/policies/${p.id}`} className="text-sm font-medium text-blue-700 hover:underline">{p.title}</Link>
                      {p.summary && <p className="text-[11px] text-gray-500 line-clamp-1">{p.summary}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{p.category ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">v{p.version}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {p.effective_from ?? '—'}{p.expires_on && <span className="text-gray-400"> → {p.expires_on}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{p.acknowledgements?.length ?? 0}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Link to={`/hr/compliance/policies/${p.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Open">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        {p.status === 'draft' && (
                          <>
                            <button onClick={() => setEditing(p)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (confirm('Publish this policy? Employees will be asked to acknowledge.')) publish.mutate(p.id) }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Publish">
                              <Send className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => { if (confirm('Delete this policy?')) del.mutate(p.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {(showNew || editing) && (
        <PolicyModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function PolicyModal({ existing, onClose }: { existing?: Policy | null; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? `Edit Policy (v${existing.version})` : 'New Policy'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Title *</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Code of Conduct" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Audience</label>
              <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="all">All employees</option>
                <option value="department">Specific department</option>
                <option value="designation">Specific designation</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Effective From</label>
              <input type="date" value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Expires On</label>
              <input type="date" value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Summary</label>
            <textarea rows={2} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Body (HTML/Markdown)</label>
            <textarea rows={10} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Attachment URL</label>
            <input value={form.attachment_url} onChange={e => setForm({ ...form, attachment_url: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requires_acknowledgement}
              onChange={e => setForm({ ...form, requires_acknowledgement: e.target.checked })} />
            Requires acknowledgement
          </label>
          {existing && existing.status === 'published' && (
            <label className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded p-2">
              <input type="checkbox" checked={bumpVersion} onChange={e => setBumpVersion(e.target.checked)} />
              Bump version (clears existing acknowledgements, requires re-ack)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
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

function CertificationsTab() {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [expiringDays, setExpiringDays] = useState('')
  const params: { employee_id?: string; expiring_within_days?: number } = {}
  if (employeeFilter) params.employee_id = employeeFilter
  if (expiringDays) params.expiring_within_days = Number(expiringDays)
  const { data: certs = [], isLoading } = useHRCertifications(params)
  const { data: employees = [] } = useHREmployees()
  const empMap = new Map((employees as EmployeeProfile[]).map(e => [e.id, e.vendor_user?.user?.full_name ?? e.employee_code]))
  const del = useDeleteHRCertification()
  const [editing, setEditing] = useState<ComplianceCertification | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex gap-2">
          <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All employees</option>
            {(employees as EmployeeProfile[]).map(e =>
              <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>)}
          </select>
          <select value={expiringDays} onChange={e => setExpiringDays(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All</option>
            <option value="30">Expiring within 30 days</option>
            <option value="90">Expiring within 90 days</option>
          </select>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Certification
        </button>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (certs as ComplianceCertification[]).length === 0 ? (
          <div className="p-12 text-center">
            <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No certifications.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['Employee', 'Certification', 'Type', 'Issued By', 'Issued', 'Expires', 'Status', 'Actions'].map(h =>
                <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(certs as ComplianceCertification[]).map(c => {
                const expiresSoon = c.expires_on && new Date(c.expires_on) < new Date(Date.now() + 30 * 86400000)
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{empMap.get(c.employee_id) ?? c.employee_id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.cert_number && <p className="text-[11px] text-gray-500">#{c.cert_number}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{c.type ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{c.issued_by ?? '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{c.issued_on ?? '—'}</td>
                    <td className={`py-3 px-4 text-xs ${expiresSoon ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {c.expires_on ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.status === 'active' ? 'bg-green-100 text-green-700'
                        : c.status === 'expired' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>{c.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm('Delete certification?')) del.mutate(c.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {(showNew || editing) && (
        <CertModal existing={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function CertModal({ existing, onClose }: { existing?: ComplianceCertification | null; onClose: () => void }) {
  const { data: employees = [] } = useHREmployees()
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{existing ? 'Edit Certification' : 'New Certification'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Employee *</label>
            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">— Select —</option>
              {(employees as EmployeeProfile[]).map(e =>
                <option key={e.id} value={e.id}>{e.vendor_user?.user?.full_name ?? e.employee_code}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Certification Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Type</label>
              <input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                placeholder="license / training / etc."
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Issued By</label>
              <input value={form.issued_by} onChange={e => setForm({ ...form, issued_by: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Cert Number</label>
              <input value={form.cert_number} onChange={e => setForm({ ...form, cert_number: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Issued On</label>
              <input type="date" value={form.issued_on} onChange={e => setForm({ ...form, issued_on: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Expires On</label>
              <input type="date" value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Document URL</label>
            <input value={form.document_url} onChange={e => setForm({ ...form, document_url: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ComplianceCertification['status'] })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
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
    <div>
      <div className="flex items-center justify-between mb-3">
        <select value={entityType} onChange={e => setEntityType(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All entity types</option>
          <option value="policy">Policy</option>
          <option value="job_posting">Job Posting</option>
          <option value="application">Application</option>
          <option value="review_cycle">Review Cycle</option>
          <option value="performance_review">Performance Review</option>
          <option value="training_program">Training Program</option>
          <option value="announcement">Announcement</option>
          <option value="expense_claim">Expense Claim</option>
        </select>
        <button onClick={vendorApi.hrDownloadAuditCsv}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (logs as ComplianceAuditLog[]).length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No audit logs.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['When', 'Actor', 'Action', 'Entity', 'Summary'].map(h =>
                <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(logs as ComplianceAuditLog[]).map(l => (
                <tr key={l.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4 text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-2 px-4 text-xs text-gray-700">{l.actor_label ?? l.actor_user_id?.slice(0, 8) ?? '—'}</td>
                  <td className="py-2 px-4 text-xs"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">{l.action}</span></td>
                  <td className="py-2 px-4 text-xs text-gray-600">{l.entity_type}{l.entity_id && <span className="text-gray-400"> #{l.entity_id.slice(0, 8)}</span>}</td>
                  <td className="py-2 px-4 text-sm text-gray-700">{l.summary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
