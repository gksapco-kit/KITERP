import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle2, History, Paperclip, Pencil, Search, Trash2, Upload, X } from 'lucide-react'
import { MasterDataPicker, type PickerOption } from '@/components/commission/MasterDataPicker'
import { pharmaApi } from '@/api/pharma'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime, mediaUrl } from '@/lib/utils'
import {
  PharmaCard,
  PharmaEmpty,
  PharmaExpiryCell,
  PharmaLoading,
  PharmaPageHeader,
  PharmaSectionTitle,
  PharmaStatusBadge,
  PharmaToolbar,
  fmtErr,
} from './pharmaShared'

type CustomerLicenseRow = {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  wholesale_license_number: string | null
  wholesale_license_expires: string | null
}

type LicenseHistoryItem = {
  id: string
  action: string
  license_number?: string | null
  license_expires?: string | null
  previous_license_number?: string | null
  previous_license_expires?: string | null
  check_ok?: boolean | null
  detail?: string | null
  created_at?: string | null
}

type LicenseDocumentItem = {
  id: string
  file_url: string
  filename: string
  content_type?: string | null
  size_bytes?: number | null
  created_at?: string | null
}

function formatBytes(n?: number | null) {
  if (n == null || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function customerName(c: any) {
  return c.company_name || c.full_name || c.id
}

function licenseValidity(
  number?: string | null,
  expires?: string | null,
): 'valid' | 'missing' | 'expired' {
  if (!number?.trim()) return 'missing'
  if (expires) {
    const end = new Date(`${expires}T23:59:59`)
    if (!Number.isNaN(end.getTime()) && end < new Date()) return 'expired'
  }
  return 'valid'
}

export default function PharmaWholesaleLicensePage() {
  const [customers, setCustomers] = useState<CustomerLicenseRow[]>([])
  const [loading, setLoading] = useState(true)

  const [listQuery, setListQuery] = useState('')
  const [listFilter, setListFilter] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState<PickerOption | null>(null)
  const [addNumber, setAddNumber] = useState('')
  const [addExpires, setAddExpires] = useState('')
  const [adding, setAdding] = useState(false)
  const [formCheckResult, setFormCheckResult] = useState<{
    ok: boolean
    detail: string
    enforced?: boolean
    license_number?: string | null
    license_expires?: string | null
  } | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNumber, setEditNumber] = useState('')
  const [editExpires, setEditExpires] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [checkById, setCheckById] = useState<
    Record<string, { ok: boolean; detail: string; enforced?: boolean }>
  >({})

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<CustomerLicenseRow | null>(null)
  const [historyItems, setHistoryItems] = useState<LicenseHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [docsOpen, setDocsOpen] = useState(false)
  const [docsCustomer, setDocsCustomer] = useState<CustomerLicenseRow | null>(null)
  const [docsItems, setDocsItems] = useState<LicenseDocumentItem[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsUploading, setDocsUploading] = useState(false)
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadLicensedCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await vendorApi.listCustomers?.({ size: 200 })
      const items = r?.items || r?.customers || []
      setCustomers(
        items
          .filter((c: any) => !!c.wholesale_license_number?.trim())
          .map((c: any) => ({
            id: c.id,
            name: customerName(c),
            phone: c.phone,
            email: c.email,
            wholesale_license_number: c.wholesale_license_number || null,
            wholesale_license_expires: c.wholesale_license_expires || null,
          })),
      )
    } catch (e: any) {
      toast.error(fmtErr(e, 'Could not load licensed customers'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLicensedCustomers()
  }, [loadLicensedCustomers])

  const licensedRows = useMemo(() => {
    const q = listFilter.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.wholesale_license_number || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
    )
  }, [customers, listFilter])

  const resetForm = () => {
    setSelectedCustomer(null)
    setAddNumber('')
    setAddExpires('')
    setFormCheckResult(null)
  }

  const onSelectCustomer = (opt: PickerOption | null) => {
    setSelectedCustomer(opt)
    setFormCheckResult(null)
    if (!opt) {
      setAddNumber('')
      setAddExpires('')
      return
    }
    const meta = opt.meta as CustomerLicenseRow | undefined
    setAddNumber(meta?.wholesale_license_number || '')
    setAddExpires(meta?.wholesale_license_expires || '')
  }

  const searchCustomersForPicker = async (q: string): Promise<PickerOption[]> => {
    const customersRes = await vendorApi.listCustomers({ search: q, size: 20 })
    return (customersRes?.items || []).map((c: any) => {
      const hasLicense = !!c.wholesale_license_number?.trim()
      return {
        id: c.id,
        label: customerName(c),
        sub: [
          hasLicense ? 'Has license' : 'No license',
          c.phone,
          c.email,
          c.wholesale_license_number,
        ]
          .filter(Boolean)
          .join(' • '),
        phone: c.phone ?? undefined,
        email: c.email ?? undefined,
        meta: {
          id: c.id,
          name: customerName(c),
          phone: c.phone,
          email: c.email,
          wholesale_license_number: c.wholesale_license_number || null,
          wholesale_license_expires: c.wholesale_license_expires || null,
        } satisfies CustomerLicenseRow,
      }
    })
  }

  const startEdit = (row: CustomerLicenseRow) => {
    setEditingId(row.id)
    setEditNumber(row.wholesale_license_number || '')
    setEditExpires(row.wholesale_license_expires || '')
    setCheckById((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditNumber('')
    setEditExpires('')
  }

  const saveRow = async (customerId: string, number: string, expires: string) => {
    setSavingId(customerId)
    try {
      await vendorApi.updateCustomer(customerId, {
        wholesale_license_number: number.trim() || '',
        wholesale_license_expires: expires.trim() || '',
      })
      toast.success(number.trim() ? 'Wholesale license saved' : 'Wholesale license cleared')
      setEditingId(null)
      resetForm()
      setCheckById((prev) => {
        const next = { ...prev }
        delete next[customerId]
        return next
      })
      await loadLicensedCustomers()
      return true
    } catch (e: any) {
      toast.error(fmtErr(e, 'Could not save license'))
      return false
    } finally {
      setSavingId(null)
    }
  }

  const addLicense = async () => {
    if (!selectedCustomer) {
      toast.error('Select a customer')
      return
    }
    if (!addNumber.trim()) {
      toast.error('License number is required')
      return
    }
    setAdding(true)
    try {
      await saveRow(selectedCustomer.id, addNumber, addExpires)
    } finally {
      setAdding(false)
    }
  }

  const applyListSearch = () => {
    setListFilter(listQuery.trim())
  }

  const checkSelected = async () => {
    if (!selectedCustomer) {
      toast.error('Select a customer to check')
      return
    }
    const customerId = selectedCustomer.id
    setCheckingId(customerId)
    setFormCheckResult(null)
    try {
      const res = await pharmaApi.checkWholesaleLicense(customerId)
      setFormCheckResult({
        ok: !!res.ok,
        detail: res.detail || (res.ok ? 'License valid' : 'License invalid or missing'),
        enforced: !!res.enforced,
        license_number: res.license_number,
        license_expires: res.license_expires,
      })
      setCheckById((prev) => ({
        ...prev,
        [customerId]: {
          ok: !!res.ok,
          detail: res.detail || (res.ok ? 'License valid' : 'License invalid or missing'),
          enforced: !!res.enforced,
        },
      }))
      if (res.license_number != null) setAddNumber(res.license_number || '')
      if (res.license_expires) setAddExpires(res.license_expires)
      else setAddExpires('')
    } catch (e: any) {
      toast.error(fmtErr(e, 'License check failed'))
    } finally {
      setCheckingId(null)
    }
  }

  const clearLicense = async (row: CustomerLicenseRow) => {
    if (!window.confirm(`Clear wholesale license for ${row.name}?`)) return
    await saveRow(row.id, '', '')
  }

  const checkRow = async (customerId: string) => {
    setCheckingId(customerId)
    try {
      const res = await pharmaApi.checkWholesaleLicense(customerId)
      setCheckById((prev) => ({
        ...prev,
        [customerId]: {
          ok: !!res.ok,
          detail: res.detail || (res.ok ? 'License valid' : 'License invalid or missing'),
          enforced: !!res.enforced,
        },
      }))
    } catch (e: any) {
      toast.error(fmtErr(e, 'License check failed'))
    } finally {
      setCheckingId(null)
    }
  }

  const openHistory = async (row: CustomerLicenseRow) => {
    setHistoryCustomer(row)
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryItems([])
    try {
      const res = await pharmaApi.wholesaleLicenseHistory(row.id)
      setHistoryItems(res?.items || [])
    } catch (e: any) {
      toast.error(fmtErr(e, 'Could not load license history'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadDocuments = async (customerId: string) => {
    const res = await pharmaApi.listWholesaleLicenseDocuments(customerId)
    const items = (res?.items || []) as LicenseDocumentItem[]
    setDocsItems(items)
    setDocCounts((prev) => ({ ...prev, [customerId]: items.length }))
    return items
  }

  const openDocuments = async (row: CustomerLicenseRow) => {
    setDocsCustomer(row)
    setDocsOpen(true)
    setDocsLoading(true)
    setDocsItems([])
    try {
      await loadDocuments(row.id)
    } catch (e: any) {
      toast.error(fmtErr(e, 'Could not load documents'))
    } finally {
      setDocsLoading(false)
    }
  }

  const uploadDocument = async (file: File) => {
    if (!docsCustomer) return
    setDocsUploading(true)
    try {
      await pharmaApi.uploadWholesaleLicenseDocument(docsCustomer.id, file)
      toast.success('Document attached')
      await loadDocuments(docsCustomer.id)
    } catch (e: any) {
      toast.error(fmtErr(e, 'Could not upload document'))
    } finally {
      setDocsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteDocument = async (doc: LicenseDocumentItem) => {
    if (!docsCustomer) return
    if (!window.confirm(`Remove “${doc.filename}”?`)) return
    try {
      await pharmaApi.deleteWholesaleLicenseDocument(doc.id)
      toast.success('Document removed')
      await loadDocuments(docsCustomer.id)
    } catch (e: any) {
      toast.error(fmtErr(e, 'Could not remove document'))
    }
  }

  const selectedId = selectedCustomer?.id || ''
  const formBusy = adding || checkingId === selectedId
  const selectedHasLicense = !!(selectedCustomer?.meta as CustomerLicenseRow | undefined)
    ?.wholesale_license_number?.trim()

  return (
    <div className="space-y-4 p-6">
      <PharmaPageHeader
        title="Wholesale license"
        subtitle="Add and maintain customer wholesale distributor licenses before shipping."
      />

      <PharmaCard>
        <p className="mb-4 text-xs text-muted-foreground">
          Find a customer, enter their wholesale license, then check validity. Enable the gate in{' '}
          <Link to="/pharma/settings" className="text-primary hover:underline">
            Foundations
          </Link>{' '}
          to block shipments when a license is expired or missing.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-[1.4] space-y-1.5 sm:min-w-[16rem]">
            <Label>Customer</Label>
            <MasterDataPicker
              compact
              placeholder="Search by name, email, or phone…"
              selected={selectedCustomer}
              onSearch={searchCustomersForPicker}
              onSelect={onSelectCustomer}
              disabled={formBusy}
            />
          </div>
          <div className="min-w-[10rem] flex-1 space-y-1.5 sm:max-w-[14rem]">
            <Label htmlFor="add-license-number">License number</Label>
            <Input
              id="add-license-number"
              value={addNumber}
              disabled={formBusy || !selectedCustomer}
              onChange={(e) => {
                setAddNumber(e.target.value)
                setFormCheckResult(null)
              }}
              placeholder="License #"
              maxLength={80}
              className="h-10"
            />
          </div>
          <div className="w-[9.5rem] shrink-0 space-y-1.5">
            <Label htmlFor="add-license-expires">Expires</Label>
            <Input
              id="add-license-expires"
              type="date"
              value={addExpires}
              disabled={formBusy || !selectedCustomer}
              onChange={(e) => {
                setAddExpires(e.target.value)
                setFormCheckResult(null)
              }}
              className="h-10"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              className="h-10"
              disabled={formBusy || !selectedCustomer || !addNumber.trim()}
              onClick={addLicense}
            >
              {adding ? 'Saving…' : selectedHasLicense ? 'Update license' : 'Add license'}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              disabled={formBusy || !selectedCustomer}
              onClick={checkSelected}
            >
              {checkingId === selectedId ? (
                'Checking…'
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Check
                </>
              )}
            </Button>
          </div>
        </div>

        {formCheckResult ? (
          <div
            className={`mt-3 rounded-md border px-4 py-3 text-sm ${
              formCheckResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">
              {formCheckResult.ok ? 'License valid' : 'License invalid or missing'}
            </div>
            {formCheckResult.license_number ? (
              <div className="mt-1 text-xs opacity-80">
                License: {formCheckResult.license_number}
                {formCheckResult.license_expires
                  ? ` · expires ${formCheckResult.license_expires}`
                  : ''}
              </div>
            ) : null}
            {!formCheckResult.ok && formCheckResult.detail ? (
              <div className="mt-1 text-xs opacity-80">{formCheckResult.detail}</div>
            ) : null}
            {!formCheckResult.enforced ? (
              <div className="mt-1 text-xs opacity-60 italic">
                Gate not enforced — enable &quot;Block ship without valid wholesale license&quot; in
                Foundations.
              </div>
            ) : null}
          </div>
        ) : null}
      </PharmaCard>

      <PharmaCard>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <PharmaSectionTitle>Licensed customers</PharmaSectionTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Customers with a wholesale license on file.
            </p>
          </div>
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Label htmlFor="licensed-customer-search" className="sr-only">
                Search licensed customers
              </Label>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="licensed-customer-search"
                value={listQuery}
                disabled={loading}
                onChange={(e) => setListQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyListSearch()
                  }
                }}
                placeholder="Filter licensed customers…"
                className="h-10 pl-8"
              />
            </div>
            <Button
              variant="outline"
              className="h-10 shrink-0"
              disabled={loading}
              onClick={applyListSearch}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Search
            </Button>
          </div>
        </div>

        {loading ? (
          <PharmaLoading rows={4} />
        ) : licensedRows.length === 0 ? (
          <PharmaEmpty
            label={listFilter ? 'No matching licensed customers' : 'No licensed customers yet'}
            hint={
              listFilter
                ? 'Try a different search, or clear the filter to see all licensed customers.'
                : 'Search for a customer above and add a wholesale license.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">License number</th>
                  <th className="py-2 pr-3 font-medium">Expires</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {licensedRows.map((row) => {
                  const isEditing = editingId === row.id
                  const busy = savingId === row.id || checkingId === row.id
                  const check = checkById[row.id]
                  const validity = check
                    ? check.ok
                      ? 'valid'
                      : licenseValidity(row.wholesale_license_number, row.wholesale_license_expires) ===
                          'expired'
                        ? 'expired'
                        : 'missing'
                    : licenseValidity(row.wholesale_license_number, row.wholesale_license_expires)

                  return (
                    <tr key={row.id} className="border-b border-border/50 align-top">
                      <td className="py-2.5 pr-3 font-medium">
                        <Link
                          to={`/customers/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        {isEditing ? (
                          <Input
                            value={editNumber}
                            disabled={busy}
                            onChange={(e) => setEditNumber(e.target.value)}
                            maxLength={80}
                            className="h-8 font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono text-xs">
                            {row.wholesale_license_number || '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editExpires}
                            disabled={busy}
                            onChange={(e) => setEditExpires(e.target.value)}
                            className="h-8 text-xs"
                          />
                        ) : (
                          <PharmaExpiryCell date={row.wholesale_license_expires} />
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <PharmaStatusBadge status={validity} />
                        {check?.detail ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">{check.detail}</div>
                        ) : null}
                      </td>
                      <td className="py-2.5">
                        {isEditing ? (
                          <PharmaToolbar className="mb-0 justify-end">
                            <Button
                              size="sm"
                              disabled={busy || !editNumber.trim()}
                              onClick={() => saveRow(row.id, editNumber, editExpires)}
                            >
                              {savingId === row.id ? 'Saving…' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={cancelEdit}
                              aria-label="Cancel edit"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </PharmaToolbar>
                        ) : (
                          <PharmaToolbar className="mb-0 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => checkRow(row.id)}
                            >
                              {checkingId === row.id ? (
                                '…'
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Check
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openHistory(row)}
                              title="History"
                            >
                              <History className="h-3.5 w-3.5" />
                              <span className="ml-1 hidden xl:inline">History</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openDocuments(row)}
                              title="Documents"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              <span className="ml-1 hidden xl:inline">Docs</span>
                              {docCounts[row.id] ? (
                                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                                  {docCounts[row.id]}
                                </span>
                              ) : null}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => startEdit(row)}
                              aria-label="Edit license"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => clearLicense(row)}
                              aria-label="Clear license"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </PharmaToolbar>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </PharmaCard>

      <Dialog
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open)
          if (!open) {
            setHistoryCustomer(null)
            setHistoryItems([])
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>License history</DialogTitle>
            <DialogDescription>
              {historyCustomer
                ? `Changes and checks for ${historyCustomer.name}`
                : 'Wholesale license activity'}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <PharmaLoading rows={4} />
          ) : historyItems.length === 0 ? (
            <PharmaEmpty
              label="No history yet"
              hint="History appears when a license is added, updated, cleared, or checked."
            />
          ) : (
            <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border/70 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PharmaStatusBadge status={item.action} />
                    <span className="text-[11px] text-muted-foreground">
                      {item.created_at ? formatDateTime(item.created_at) : '—'}
                    </span>
                  </div>
                  {item.action === 'checked' ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {item.check_ok ? 'Result: valid' : 'Result: invalid'}
                      {item.detail ? ` — ${item.detail}` : ''}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {item.license_number
                        ? `License ${item.license_number}${
                            item.license_expires ? ` · expires ${item.license_expires}` : ''
                          }`
                        : 'License cleared'}
                      {item.previous_license_number
                        ? ` (was ${item.previous_license_number}${
                            item.previous_license_expires
                              ? ` · ${item.previous_license_expires}`
                              : ''
                          })`
                        : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={docsOpen}
        onOpenChange={(open) => {
          setDocsOpen(open)
          if (!open) {
            setDocsCustomer(null)
            setDocsItems([])
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>License documents</DialogTitle>
            <DialogDescription>
              {docsCustomer
                ? `Attachments for ${docsCustomer.name}`
                : 'Wholesale license documents'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              PDF, images, Word, or Excel · max 15 MB
            </p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadDocument(file)
                }}
              />
              <Button
                size="sm"
                disabled={docsLoading || docsUploading || !docsCustomer}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {docsUploading ? 'Uploading…' : 'Attach'}
              </Button>
            </div>
          </div>

          {docsLoading ? (
            <PharmaLoading rows={3} />
          ) : docsItems.length === 0 ? (
            <PharmaEmpty
              label="No documents yet"
              hint="Attach a scanned license, certificate, or supporting file."
            />
          ) : (
            <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {docsItems.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-md border border-border/70 px-3 py-2.5"
                >
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={mediaUrl(doc.file_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-primary hover:underline"
                    >
                      {doc.filename}
                    </a>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {[formatBytes(doc.size_bytes), doc.created_at ? formatDateTime(doc.created_at) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${doc.filename}`}
                    onClick={() => deleteDocument(doc)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
