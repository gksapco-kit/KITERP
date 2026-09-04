import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useDeactivateSupplier, useReactivateSupplier } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  SelectRoot as Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddPartyModal } from '@/components/parties/AddPartyModal'
import { vendorApi } from '@/api/vendor'
import { formatDate } from '@/lib/utils'
import type {
  Supplier,
  SupplierContact,
  SupplierDocument,
  SupplierOnboarding,
  SupplierPerformance,
} from '@/types'
import {
  Users, Plus, Trash2, Star, ShieldCheck, Pencil,
  FileText, Phone, BarChart3, AlertCircle, MapPin, Tag,
  CheckCircle2, Clock, Upload, ExternalLink, Building2, X,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────
// Status badges
// ─────────────────────────────────────────────────────────────────

const ONBOARDING_STATUS: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'bg-gray-100 text-gray-700' },
  submitted:    { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'Under Review', cls: 'bg-yellow-100 text-yellow-700' },
  approved:     { label: 'Approved',     cls: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-100 text-red-700' },
  on_hold:      { label: 'On Hold',      cls: 'bg-orange-100 text-orange-700' },
  blacklisted:  { label: 'Blacklisted',  cls: 'bg-red-200 text-red-900' },
}

const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  valid:                { label: 'Valid',     cls: 'bg-green-100 text-green-700' },
  expiring_soon:        { label: 'Expiring',  cls: 'bg-yellow-100 text-yellow-700' },
  expired:              { label: 'Expired',   cls: 'bg-red-100 text-red-700' },
  pending_verification: { label: 'Pending',   cls: 'bg-gray-100 text-gray-600' },
  rejected:             { label: 'Rejected',  cls: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const cfg = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-gray-400 text-sm">—</span>
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`text-sm font-bold ${color}`}>{score.toFixed(1)}</span>
}

// ─────────────────────────────────────────────────────────────────
// Shared confirm dialog
// ─────────────────────────────────────────────────────────────────

function ConfirmDialog({
  open, onOpenChange, title, description, onConfirm, danger = false, busy = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  danger?: boolean
  busy?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500 py-1">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className={danger ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {busy ? 'Working…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────
// Supplier list panel
// ─────────────────────────────────────────────────────────────────

const PARTY_TYPE_LABEL: Record<string, string> = {
  supplier: 'Vendor',
  employee: 'Employee',
  partner: 'Partner',
  contractor: 'Contractor',
}

function supplierIdentifier(s: Supplier): string {
  return s.gstin || s.pan_number || s.company_name || s.email || s.phone || 'No identifier'
}

function SupplierList({
  suppliers = [],
  isLoading,
  onSelect,
  selectedId,
  onCreated,
}: {
  suppliers?: Supplier[]
  isLoading: boolean
  onSelect: (s: Supplier) => void
  selectedId: string | null
  onCreated: (supplierId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = (suppliers ?? []).filter(s => {
    if (s.party_type && s.party_type !== 'supplier' && s.party_type !== 'contractor' && s.party_type !== 'partner') {
      return false
    }
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.name?.toLowerCase().includes(q) ||
      s.gstin?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.company_name?.toLowerCase().includes(q) ||
      s.pan_number?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-sm text-gray-800">Suppliers</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-3 h-3 mr-1" />New
          </Button>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">
          From{' '}
          <Link to="/master-data" className="text-blue-600 hover:underline">
            Master Data
          </Link>
        </p>
        <Input
          placeholder="Search name, GSTIN, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="text-center py-6 text-sm text-gray-500">Loading…</p>}
        {filtered.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${selectedId === s.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
          >
            <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
            <p className="text-xs text-gray-500 truncate">{supplierIdentifier(s)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs px-1.5 py-0.5 rounded ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
              {s.party_type && s.party_type !== 'supplier' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-50 text-slate-600">
                  {PARTY_TYPE_LABEL[s.party_type] ?? s.party_type}
                </span>
              )}
            </div>
          </button>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center py-8 text-sm text-gray-400">
            No suppliers found. Create one with New.
          </p>
        )}
      </div>

      {showAdd && (
        <AddPartyModal
          defaultType="supplier"
          onClose={() => setShowAdd(false)}
          onCreated={(party) => {
            setShowAdd(false)
            const roles = (party as { roles?: Array<{ supplier_id?: string | null; role?: string }> }).roles ?? []
            const supplierRole = roles.find(r => r.supplier_id && r.role !== 'customer')
              ?? roles.find(r => r.supplier_id)
            if (supplierRole?.supplier_id) onCreated(supplierRole.supplier_id)
            else onCreated('')
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Contacts tab
// ─────────────────────────────────────────────────────────────────

const BLANK_CONTACT = { name: '', designation: '', department: '', email: '', phone: '', mobile: '', is_primary: false }

function ContactsTab({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editContact, setEditContact] = useState<SupplierContact | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_CONTACT)

  const { data } = useQuery({
    queryKey: ['supplier-contacts', supplier.id],
    queryFn: () => vendorApi.listSupplierContacts(supplier.id),
  })
  const contacts: SupplierContact[] = data?.items ?? []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier-contacts', supplier.id] })

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.createSupplierContact(supplier.id, d),
    onSuccess: () => { invalidate(); setShowAdd(false); setForm(BLANK_CONTACT); toast.success('Contact added') },
    onError: () => toast.error('Could not add contact'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) =>
      vendorApi.updateSupplierContact(supplier.id, id, d),
    onSuccess: () => { invalidate(); setEditContact(null); toast.success('Contact updated') },
    onError: () => toast.error('Could not update contact'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => vendorApi.deleteSupplierContact(supplier.id, id),
    onSuccess: () => { invalidate(); setDeleteId(null); toast.success('Contact removed') },
    onError: () => toast.error('Could not remove contact'),
  })

  function openEdit(c: SupplierContact) {
    setEditContact(c)
    setForm({
      name: c.name,
      designation: c.designation ?? '',
      department: c.department ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      mobile: c.mobile ?? '',
      is_primary: c.is_primary,
    })
  }

  const ContactFormFields = (
    <div className="space-y-3 py-2">
      <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
        <div><Label>Department</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><Label>Mobile</Label><Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
        Set as primary contact
      </label>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Contacts ({contacts.length})</h3>
        <Button size="sm" variant="outline" onClick={() => { setForm(BLANK_CONTACT); setShowAdd(true) }}>
          <Plus className="w-3 h-3 mr-1" />Add Contact
        </Button>
      </div>

      {contacts.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No contacts added yet</p>}
      <div className="space-y-2">
        {contacts.map(c => (
          <div key={c.id} className="flex items-start justify-between p-3 border rounded-lg bg-gray-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                {c.is_primary && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>}
              </div>
              {c.designation && <p className="text-xs text-gray-500">{c.designation}{c.department ? ` · ${c.department}` : ''}</p>}
              <p className="text-xs text-gray-600 mt-0.5">{[c.email, c.phone, c.mobile].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-600" onClick={() => openEdit(c)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setDeleteId(c.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          {ContactFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate({ ...form })} disabled={!form.name || createMut.isPending}>
              {createMut.isPending ? 'Saving…' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editContact} onOpenChange={v => { if (!v) setEditContact(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          {ContactFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
            <Button
              onClick={() => editContact && updateMut.mutate({ id: editContact.id, d: { ...form } })}
              disabled={!form.name || updateMut.isPending}
            >
              {updateMut.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={v => { if (!v) setDeleteId(null) }}
        title="Remove contact?"
        description="This contact will be permanently removed from the supplier."
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        danger
        busy={deleteMut.isPending}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Documents tab
// ─────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  'gstin_certificate', 'pan_card', 'msme_certificate', 'iso_certification',
  'bank_verification', 'trade_license', 'fssai_license', 'other',
]

function DocumentsTab({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [rejectDocId, setRejectDocId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [form, setForm] = useState({ document_type: '', document_number: '', file_url: '', expiry_date: '', notes: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({
    queryKey: ['supplier-docs', supplier.id],
    queryFn: () => vendorApi.listSupplierDocuments(supplier.id),
  })
  const docs: SupplierDocument[] = data?.items ?? []

  const resetForm = () => {
    setForm({ document_type: '', document_number: '', file_url: '', expiry_date: '', notes: '' })
    setSelectedFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier-docs', supplier.id] })

  const createMut = useMutation({
    mutationFn: async () => {
      let fileUrl = form.file_url.trim()
      if (selectedFile) {
        const uploaded = await vendorApi.uploadSupplierDocumentFile(supplier.id, selectedFile)
        fileUrl = uploaded.file_url
      }
      return vendorApi.createSupplierDocument(supplier.id, {
        document_type: form.document_type,
        document_number: form.document_number || undefined,
        file_url: fileUrl || undefined,
        expiry_date: form.expiry_date || undefined,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => { invalidate(); setShowAdd(false); resetForm(); toast.success('Document added') },
    onError: () => toast.error('Could not save document'),
  })

  const verifyMut = useMutation({
    mutationFn: ({ docId, status, rejection_reason }: { docId: string; status: string; rejection_reason?: string }) =>
      vendorApi.verifySupplierDocument(supplier.id, docId, { status, rejection_reason }),
    onSuccess: () => { invalidate(); setRejectDocId(null); setRejectReason(''); toast.success('Document status updated') },
    onError: () => toast.error('Could not update document status'),
  })

  const deleteMut = useMutation({
    mutationFn: (docId: string) => vendorApi.deleteSupplierDocument(supplier.id, docId),
    onSuccess: () => { invalidate(); setDeleteDocId(null); toast.success('Document removed') },
    onError: () => toast.error('Could not remove document'),
  })

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Documents ({docs.length})</h3>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="w-3 h-3 mr-1" />Upload
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map(d => (
            <TableRow key={d.id}>
              <TableCell className="text-sm font-medium capitalize">{d.document_type.replace(/_/g, ' ')}</TableCell>
              <TableCell className="text-sm text-gray-600">{d.document_number || '—'}</TableCell>
              <TableCell className="text-sm">{d.expiry_date ? formatDate(d.expiry_date) : '—'}</TableCell>
              <TableCell><StatusBadge status={d.status} map={DOC_STATUS} /></TableCell>
              <TableCell>
                <div className="flex gap-1 items-center">
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-blue-500 hover:text-blue-700" title="View file">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {d.status === 'pending_verification' && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 text-xs text-green-600"
                        onClick={() => verifyMut.mutate({ docId: d.id, status: 'valid' })}>
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />Verify
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-xs text-red-500"
                        onClick={() => { setRejectDocId(d.id); setRejectReason('') }}>
                        Reject
                      </Button>
                    </>
                  )}
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600"
                    onClick={() => setDeleteDocId(d.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {docs.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400 py-6">No documents uploaded</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {/* Upload dialog */}
      <Dialog open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Document Type *</Label>
              <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Document Number</Label><Input value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} /></div>
            <div>
              <Label>File</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                {preview ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={preview} className="max-h-28 rounded object-contain" alt="preview" />
                    <p className="text-xs text-muted-foreground truncate max-w-full">{selectedFile?.name}</p>
                  </div>
                ) : selectedFile ? (
                  <div className="flex flex-col items-center gap-1.5 py-1">
                    <FileText className="w-8 h-8 text-orange-400" />
                    <p className="text-sm font-medium truncate max-w-full">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-2 text-muted-foreground">
                    <Upload className="w-7 h-7" />
                    <p className="text-sm">Click to select file</p>
                    <p className="text-xs">Images, PDF, Word — max 10 MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" className="sr-only" onChange={handleFileSelect} />
              </div>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="mt-1.5 text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Remove file
                </button>
              )}
            </div>
            {!selectedFile && (
              <div>
                <Label>Or File URL</Label>
                <Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://…" />
              </div>
            )}
            <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.document_type || createMut.isPending}>
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason dialog */}
      <Dialog open={!!rejectDocId} onOpenChange={v => { if (!v) { setRejectDocId(null); setRejectReason('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Document</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Rejection Reason *</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Explain why this document is rejected…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDocId(null); setRejectReason('') }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectReason.trim() || verifyMut.isPending}
              onClick={() => rejectDocId && verifyMut.mutate({ docId: rejectDocId, status: 'rejected', rejection_reason: rejectReason })}
            >
              {verifyMut.isPending ? 'Saving…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteDocId}
        onOpenChange={v => { if (!v) setDeleteDocId(null) }}
        title="Remove document?"
        description="This document record will be permanently deleted."
        onConfirm={() => deleteDocId && deleteMut.mutate(deleteDocId)}
        danger
        busy={deleteMut.isPending}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Onboarding tab
// ─────────────────────────────────────────────────────────────────

function OnboardingTab({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [reviewAction, setReviewAction] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewScore, setReviewScore] = useState('')
  const [editForm, setEditForm] = useState({
    payment_terms: '', credit_limit: '', currency: 'INR', re_evaluation_due: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-onboarding', supplier.id],
    queryFn: () => vendorApi.getSupplierOnboarding(supplier.id).catch(() => null),
  })
  const ob: SupplierOnboarding | null = data ?? null

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier-onboarding', supplier.id] })

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.createSupplierOnboarding(supplier.id, d),
    onSuccess: () => { invalidate(); setShowCreate(false); toast.success('Onboarding started') },
    onError: () => toast.error('Could not start onboarding'),
  })
  const updateMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.updateSupplierOnboarding(supplier.id, d),
    onSuccess: () => { invalidate(); setShowEdit(false); toast.success('Onboarding updated') },
    onError: () => toast.error('Could not update onboarding'),
  })
  const submitMut = useMutation({
    mutationFn: () => vendorApi.submitSupplierOnboarding(supplier.id),
    onSuccess: () => { invalidate(); toast.success('Submitted for review') },
    onError: () => toast.error('Could not submit onboarding'),
  })
  const startReviewMut = useMutation({
    mutationFn: () => vendorApi.startReviewSupplierOnboarding(supplier.id),
    onSuccess: () => { invalidate(); toast.success('Moved to under review') },
    onError: () => toast.error('Could not start review — you may need approval permission'),
  })
  const reviewMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.reviewSupplierOnboarding(supplier.id, d),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'suppliers'] })
      setShowReview(false)
      setReviewNote('')
      setReviewScore('')
      toast.success('Decision saved')
    },
    onError: () => toast.error('Could not save decision — you may need approval permission'),
  })

  function openEdit() {
    setEditForm({
      payment_terms: ob?.payment_terms ?? '',
      credit_limit: ob?.credit_limit != null ? String(ob.credit_limit) : '',
      currency: ob?.currency ?? 'INR',
      re_evaluation_due: ob?.re_evaluation_due ?? '',
    })
    setShowEdit(true)
  }

  if (isLoading) return <p className="text-sm text-gray-400 py-4">Loading…</p>

  if (!ob) {
    return (
      <div className="text-center py-8">
        <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 mb-4">No onboarding record yet. Start the qualification process.</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>Start Onboarding</Button>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Start Supplier Onboarding</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-500 py-2">This creates a draft qualification record for {supplier.name}.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate({ currency: 'INR' })} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const needsRejectionReason = reviewAction === 'reject'

  return (
    <div className="space-y-4">
      {/* Status row + action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={ob.status} map={ONBOARDING_STATUS} />
          {ob.qualification_score != null && (
            <span className="text-sm text-gray-600">Score: <ScoreBadge score={ob.qualification_score} /></span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ob.status === 'draft' && (
            <>
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
              <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
                Submit for Review
              </Button>
            </>
          )}
          {ob.status === 'submitted' && (
            <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300"
              onClick={() => startReviewMut.mutate()} disabled={startReviewMut.isPending}>
              Start Review
            </Button>
          )}
          {(ob.status === 'submitted' || ob.status === 'under_review') && (
            <>
              <Button size="sm" variant="outline" className="text-green-600 border-green-300"
                onClick={() => { setReviewAction('approve'); setShowReview(true) }}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve
              </Button>
              <Button size="sm" variant="outline" className="text-red-500 border-red-300"
                onClick={() => { setReviewAction('reject'); setShowReview(true) }}>
                Reject
              </Button>
            </>
          )}
          {ob.status === 'approved' && (
            <>
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
              <Button size="sm" variant="outline" className="text-orange-500 border-orange-300"
                onClick={() => { setReviewAction('put_on_hold'); setShowReview(true) }}>
                Put On Hold
              </Button>
            </>
          )}
          {['approved', 'on_hold', 'submitted', 'under_review'].includes(ob.status) && (
            <Button size="sm" variant="outline" className="text-red-700 border-red-300"
              onClick={() => { setReviewAction('blacklist'); setShowReview(true) }}>
              Blacklist
            </Button>
          )}
        </div>
      </div>

      {/* Key fields */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {ob.payment_terms && <div><span className="text-gray-500">Payment Terms:</span> <span className="font-medium">{ob.payment_terms}</span></div>}
        {ob.credit_limit != null && <div><span className="text-gray-500">Credit Limit:</span> <span className="font-medium">{ob.currency} {ob.credit_limit.toLocaleString()}</span></div>}
        {ob.approved_at && <div><span className="text-gray-500">Approved:</span> <span className="font-medium">{formatDate(ob.approved_at)}</span></div>}
        {ob.re_evaluation_due && <div><span className="text-gray-500">Re-evaluation:</span> <span className="font-medium">{formatDate(ob.re_evaluation_due)}</span></div>}
        {ob.rejection_reason && <div className="col-span-2"><span className="text-gray-500">Reason:</span> <span className="font-medium text-red-600">{ob.rejection_reason}</span></div>}
      </div>

      {/* Checklist */}
      {ob.checklist.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Checklist</h4>
          <div className="space-y-1">
            {ob.checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {item.passed
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-gray-300 shrink-0" />}
                <span className={item.passed ? 'text-gray-700' : 'text-gray-400'}>{item.item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit history */}
      {ob.audit_log.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">History</h4>
          <div className="space-y-1">
            {[...ob.audit_log].reverse().slice(0, 8).map((entry, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3 shrink-0 mt-0.5" />
                <span className="capitalize font-medium text-gray-700">{String(entry.action).replace(/_/g, ' ')}</span>
                <span>{String(entry.at || '').slice(0, 10)}</span>
                {entry.reason && <span className="text-red-500 truncate max-w-[160px]">— {String(entry.reason)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit fields dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Onboarding Details</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Payment Terms</Label><Input value={editForm.payment_terms} onChange={e => setEditForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. Net 30" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Credit Limit</Label><Input type="number" value={editForm.credit_limit} onChange={e => setEditForm(f => ({ ...f, credit_limit: e.target.value }))} /></div>
              <div>
                <Label>Currency</Label>
                <Select value={editForm.currency} onValueChange={v => setEditForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Re-evaluation Due</Label><Input type="date" value={editForm.re_evaluation_due} onChange={e => setEditForm(f => ({ ...f, re_evaluation_due: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={() => updateMut.mutate({
              payment_terms: editForm.payment_terms || undefined,
              credit_limit: editForm.credit_limit ? Number(editForm.credit_limit) : undefined,
              currency: editForm.currency,
              re_evaluation_due: editForm.re_evaluation_due || undefined,
            })} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review action dialog */}
      <Dialog open={showReview} onOpenChange={v => { setShowReview(v); if (!v) { setReviewNote(''); setReviewScore('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">{reviewAction.replace(/_/g, ' ')} Supplier</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {reviewAction === 'approve' && (
              <div>
                <Label>Qualification Score (0–100)</Label>
                <Input type="number" min={0} max={100} value={reviewScore} onChange={e => setReviewScore(e.target.value)} placeholder="Optional" />
              </div>
            )}
            <div>
              <Label>{needsRejectionReason ? 'Rejection Reason *' : 'Notes (optional)'}</Label>
              <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3} placeholder="Reason or comments…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReview(false)}>Cancel</Button>
            <Button
              onClick={() => reviewMut.mutate({
                action: reviewAction,
                rejection_reason: reviewNote || undefined,
                qualification_score: reviewScore ? Number(reviewScore) : undefined,
              })}
              disabled={reviewMut.isPending || (needsRejectionReason && !reviewNote.trim())}
              className={reviewAction === 'blacklist' ? 'bg-red-700 hover:bg-red-800 text-white' : ''}
            >
              {reviewMut.isPending ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Performance tab
// ─────────────────────────────────────────────────────────────────

const PERIOD_TYPES = ['monthly', 'quarterly', 'annual'] as const

function PerformanceTab({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const BLANK_PERF = { period_type: 'monthly', period_start: '', period_end: '', on_time_delivery_pct: '', quality_acceptance_pct: '', price_variance_pct: '', response_time_days: '', po_count: '', comments: '' }
  const [form, setForm] = useState(BLANK_PERF)

  const { data: summary } = useQuery({
    queryKey: ['supplier-perf-summary', supplier.id],
    queryFn: () => vendorApi.getSupplierPerformanceSummary(supplier.id),
  })
  const { data: history } = useQuery({
    queryKey: ['supplier-perf-history', supplier.id],
    queryFn: () => vendorApi.listSupplierPerformance(supplier.id, { limit: 12 }),
  })

  const latest: SupplierPerformance | null = summary?.latest ?? null
  const avg: number | null = summary?.avg_score_4p ?? null
  const historyItems: SupplierPerformance[] = history?.items ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['supplier-perf-summary', supplier.id] })
    qc.invalidateQueries({ queryKey: ['supplier-perf-history', supplier.id] })
  }

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.createSupplierPerformance(supplier.id, d),
    onSuccess: () => { invalidate(); setShowAdd(false); setForm(BLANK_PERF); toast.success('Performance record added') },
    onError: () => toast.error('Could not save performance record'),
  })

  const Metric = ({ label, value, unit = '%' }: { label: string; value?: number | null; unit?: string }) => (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value != null ? `${value.toFixed(1)}${unit}` : '—'}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">Performance</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1" />Add Record
        </Button>
      </div>

      {avg != null && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <Star className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-xs text-blue-600">Rolling avg (last 4 periods)</p>
            <p className="text-2xl font-bold text-blue-700">{avg.toFixed(1)}<span className="text-sm font-normal text-blue-500">/100</span></p>
          </div>
        </div>
      )}

      {latest ? (
        <>
          <p className="text-xs text-gray-500">Latest: {formatDate(latest.period_start)} – {formatDate(latest.period_end)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="On-Time Delivery" value={latest.on_time_delivery_pct} />
            <Metric label="Quality Acceptance" value={latest.quality_acceptance_pct} />
            <Metric label="Price Variance" value={latest.price_variance_pct} />
            <Metric label="Response Time" value={latest.response_time_days} unit=" days" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Overall Score</span>
            <ScoreBadge score={latest.overall_score} />
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No performance data yet. Add a record to get started.</p>
        </div>
      )}

      {historyItems.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">History</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>POs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyItems.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{formatDate(p.period_start)} – {formatDate(p.period_end)}</TableCell>
                  <TableCell className="text-xs capitalize">{p.period_type}</TableCell>
                  <TableCell><ScoreBadge score={p.overall_score} /></TableCell>
                  <TableCell className="text-xs">{p.po_count ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Performance Record</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Period Type</Label>
              <Select value={form.period_type} onValueChange={v => setForm(f => ({ ...f, period_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Period Start *</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div>
              <div><Label>Period End *</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div>
              <div><Label>On-Time Delivery %</Label><Input type="number" min={0} max={100} value={form.on_time_delivery_pct} onChange={e => setForm(f => ({ ...f, on_time_delivery_pct: e.target.value }))} /></div>
              <div><Label>Quality Acceptance %</Label><Input type="number" min={0} max={100} value={form.quality_acceptance_pct} onChange={e => setForm(f => ({ ...f, quality_acceptance_pct: e.target.value }))} /></div>
              <div><Label>Price Variance %</Label><Input type="number" value={form.price_variance_pct} onChange={e => setForm(f => ({ ...f, price_variance_pct: e.target.value }))} /></div>
              <div><Label>Response Time (days)</Label><Input type="number" min={0} value={form.response_time_days} onChange={e => setForm(f => ({ ...f, response_time_days: e.target.value }))} /></div>
              <div><Label>PO Count</Label><Input type="number" min={0} value={form.po_count} onChange={e => setForm(f => ({ ...f, po_count: e.target.value }))} /></div>
            </div>
            <div><Label>Comments</Label><Textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate({
                period_type: form.period_type,
                period_start: form.period_start,
                period_end: form.period_end,
                on_time_delivery_pct: form.on_time_delivery_pct ? Number(form.on_time_delivery_pct) : undefined,
                quality_acceptance_pct: form.quality_acceptance_pct ? Number(form.quality_acceptance_pct) : undefined,
                price_variance_pct: form.price_variance_pct ? Number(form.price_variance_pct) : undefined,
                response_time_days: form.response_time_days ? Number(form.response_time_days) : undefined,
                po_count: form.po_count ? Number(form.po_count) : undefined,
                comments: form.comments || undefined,
              })}
              disabled={!form.period_start || !form.period_end || createMut.isPending}
            >
              {createMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Categories tab
// ─────────────────────────────────────────────────────────────────

function CategoriesTab({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient()
  const [showManage, setShowManage] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const { data: assigned } = useQuery({
    queryKey: ['supplier-categories', supplier.id],
    queryFn: () => vendorApi.getSupplierCategories(supplier.id),
  })
  const { data: allCats, isLoading: catsLoading } = useQuery({
    queryKey: ['supplier-categories-all'],
    queryFn: () => vendorApi.listSupplierCategories(),
    enabled: showManage,
  })

  const assignedItems: Array<{ id: string; name: string; code?: string }> = assigned?.items ?? []
  const allItems: Array<{ id: string; name: string; code?: string }> = allCats?.items ?? []

  const assignMut = useMutation({
    mutationFn: (ids: string[]) => vendorApi.assignSupplierCategories(supplier.id, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-categories', supplier.id] })
      setShowManage(false)
      toast.success('Categories updated')
    },
    onError: () => toast.error('Could not update categories'),
  })

  function openManage() {
    setSelected(assignedItems.map(c => c.id))
    setShowManage(true)
  }

  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Categories ({assignedItems.length})</h3>
        <Button size="sm" variant="outline" onClick={openManage}><Tag className="w-3 h-3 mr-1" />Manage</Button>
      </div>

      {assignedItems.length === 0
        ? <p className="text-sm text-gray-400 py-4 text-center">No categories assigned yet</p>
        : (
          <div className="flex flex-wrap gap-2">
            {assignedItems.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {c.name}
                {c.code && <span className="text-blue-400">({c.code})</span>}
              </span>
            ))}
          </div>
        )
      }

      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Categories</DialogTitle></DialogHeader>
          <div className="py-2 max-h-64 overflow-y-auto space-y-1">
            {catsLoading && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
            {!catsLoading && allItems.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No categories available. Create categories first.</p>
            )}
            {allItems.map(c => (
              <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="rounded" />
                <span>{c.name}</span>
                {c.code && <span className="text-gray-400 text-xs">({c.code})</span>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManage(false)}>Cancel</Button>
            <Button onClick={() => assignMut.mutate(selected)} disabled={assignMut.isPending}>
              {assignMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Addresses tab
// ─────────────────────────────────────────────────────────────────

const ADDRESS_TYPES = ['billing', 'registered', 'dispatch', 'warehouse', 'other']

interface AddressRecord {
  id: string
  address_type: string
  line1: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
  gstin?: string
  is_default: boolean
}

const BLANK_ADDR = { address_type: 'billing', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India', gstin: '', is_default: false }

function AddressesTab({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editAddr, setEditAddr] = useState<AddressRecord | null>(null)
  const [deleteAddrId, setDeleteAddrId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_ADDR)

  const { data } = useQuery({
    queryKey: ['supplier-addresses', supplier.id],
    queryFn: () => vendorApi.listSupplierAddresses(supplier.id),
  })
  const addrs: AddressRecord[] = data?.items ?? []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier-addresses', supplier.id] })

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => vendorApi.createSupplierAddress(supplier.id, d),
    onSuccess: () => { invalidate(); setShowAdd(false); setForm(BLANK_ADDR); toast.success('Address added') },
    onError: () => toast.error('Could not add address'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) =>
      vendorApi.updateSupplierAddress(supplier.id, id, d),
    onSuccess: () => { invalidate(); setEditAddr(null); toast.success('Address updated') },
    onError: () => toast.error('Could not update address'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => vendorApi.deleteSupplierAddress(supplier.id, id),
    onSuccess: () => { invalidate(); setDeleteAddrId(null); toast.success('Address removed') },
    onError: () => toast.error('Could not remove address'),
  })

  function openEdit(a: AddressRecord) {
    setEditAddr(a)
    setForm({
      address_type: a.address_type,
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      pincode: a.pincode ?? '',
      country: a.country ?? 'India',
      gstin: a.gstin ?? '',
      is_default: a.is_default,
    })
  }

  const AddressFormFields = (
    <div className="space-y-3 py-2">
      <div>
        <Label>Address Type</Label>
        <Select value={form.address_type} onValueChange={v => setForm(f => ({ ...f, address_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ADDRESS_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Line 1 *</Label><Input value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} /></div>
      <div><Label>Line 2</Label><Input value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
        <div><Label>State</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
        <div><Label>Pincode</Label><Input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} /></div>
        <div><Label>Country</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
      </div>
      <div><Label>GSTIN (address-specific)</Label><Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} /></div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
        Set as default address
      </label>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Addresses ({addrs.length})</h3>
        <Button size="sm" variant="outline" onClick={() => { setForm(BLANK_ADDR); setShowAdd(true) }}>
          <Plus className="w-3 h-3 mr-1" />Add Address
        </Button>
      </div>

      {addrs.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No addresses added yet</p>}
      <div className="space-y-2">
        {addrs.map(a => (
          <div key={a.id} className="flex items-start justify-between p-3 border rounded-lg bg-gray-50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">{a.address_type}</span>
                {a.is_default && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Default</span>}
              </div>
              <p className="text-sm text-gray-800">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
              <p className="text-xs text-gray-500">{[a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ')}</p>
              {a.gstin && <p className="text-xs text-gray-400 mt-0.5">GSTIN: {a.gstin}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-600" onClick={() => openEdit(a)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setDeleteAddrId(a.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Address</DialogTitle></DialogHeader>
          {AddressFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate({ ...form })} disabled={!form.line1 || createMut.isPending}>
              {createMut.isPending ? 'Saving…' : 'Add Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAddr} onOpenChange={v => { if (!v) setEditAddr(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Address</DialogTitle></DialogHeader>
          {AddressFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAddr(null)}>Cancel</Button>
            <Button
              onClick={() => editAddr && updateMut.mutate({ id: editAddr.id, d: { ...form } })}
              disabled={!form.line1 || updateMut.isPending}
            >
              {updateMut.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteAddrId}
        onOpenChange={v => { if (!v) setDeleteAddrId(null) }}
        title="Remove address?"
        description="This address will be permanently removed."
        onConfirm={() => deleteAddrId && deleteMut.mutate(deleteAddrId)}
        danger
        busy={deleteMut.isPending}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Supplier detail panel
// ─────────────────────────────────────────────────────────────────

function SupplierDetail({ supplier }: { supplier: Supplier }) {
  const deactivateMut = useDeactivateSupplier()
  const reactivateMut = useReactivateSupplier()
  const isBusy = deactivateMut.isPending || reactivateMut.isPending
  const identifier = supplierIdentifier(supplier)
  const addr = supplier.address
  const addressLine = addr
    ? [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')
    : ''

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 truncate">{supplier.name}</h2>
          <p className="text-sm text-gray-500 truncate">{identifier}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {PARTY_TYPE_LABEL[supplier.party_type] ?? 'Vendor'}
            </span>
            {supplier.company_name && <span>{supplier.company_name}</span>}
            {supplier.contact_name && <span>Contact: {supplier.contact_name}</span>}
            {supplier.phone && <span>{supplier.phone}</span>}
            {supplier.email && <span className="truncate max-w-[220px]">{supplier.email}</span>}
          </div>
          {addressLine && <p className="text-xs text-gray-400 mt-1 truncate">{addressLine}</p>}
          <Link to="/master-data" className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline">
            Open in Master Data <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {supplier.is_active ? 'Active' : 'Inactive'}
          </span>
          {supplier.is_active ? (
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={isBusy}
              onClick={() => deactivateMut.mutate(supplier.id)}>
              Deactivate
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" disabled={isBusy}
              onClick={() => reactivateMut.mutate(supplier.id)}>
              Reactivate
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="contacts"><Phone className="w-3.5 h-3.5 mr-1.5" />Contacts</TabsTrigger>
          <TabsTrigger value="addresses"><MapPin className="w-3.5 h-3.5 mr-1.5" />Addresses</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1.5" />Documents</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="w-3.5 h-3.5 mr-1.5" />Categories</TabsTrigger>
          <TabsTrigger value="onboarding"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Onboarding</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts"><ContactsTab supplier={supplier} /></TabsContent>
        <TabsContent value="addresses"><AddressesTab supplier={supplier} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab supplier={supplier} /></TabsContent>
        <TabsContent value="categories"><CategoriesTab supplier={supplier} /></TabsContent>
        <TabsContent value="onboarding"><OnboardingTab supplier={supplier} /></TabsContent>
        <TabsContent value="performance"><PerformanceTab supplier={supplier} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function SupplierManagementPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => vendorApi.listSuppliers(),
  })
  const suppliers: Supplier[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : []
  const selected = suppliers.find(s => s.id === selectedId) ?? null

  useEffect(() => {
    if (selectedId && !isLoading && !suppliers.some(s => s.id === selectedId)) {
      setSelectedId(null)
    }
  }, [selectedId, suppliers, isLoading])

  const handleCreated = (supplierId: string) => {
    qc.invalidateQueries({ queryKey: ['suppliers'] })
    qc.invalidateQueries({ queryKey: ['vendor', 'suppliers'] })
    if (supplierId) setSelectedId(supplierId)
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="w-72 shrink-0 flex flex-col">
        <SupplierList
          suppliers={suppliers}
          isLoading={isLoading}
          onSelect={s => setSelectedId(s.id)}
          selectedId={selectedId}
          onCreated={handleCreated}
        />
      </div>

      {selected ? (
        <SupplierDetail supplier={selected} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center max-w-sm px-4">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              Select a supplier to manage contacts, addresses, documents, categories, onboarding, and performance
            </p>
            <Link to="/master-data" className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline">
              Manage vendors in Master Data <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
