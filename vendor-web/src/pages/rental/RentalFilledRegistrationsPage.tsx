import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldLabel } from '@/components/common/FieldLabel'
import { extractApiError } from '@/lib/errorMessages'
import { downloadAsPdf } from '@/lib/printUtils'
import { cn } from '@/lib/utils'
import { rentalApi } from './api'
import { RegistrationFormFields } from './RegistrationFormFields'
import { RegistrationAnswersPanel } from './RegistrationAnswersPanel'
import type { RegistrationFormRecord } from './registrationFormTemplates'
import {
  buildRegistrationCsv,
  buildRegistrationHtml,
  downloadBlob,
  registrationFileName,
  type DownloadSubmission,
} from './registrationDownload'

type SubmissionRow = DownloadSubmission & {
  form_id?: string
  booking_id?: string | null
  deleted_at?: string | null
}

type FolderGroup = {
  id: string
  name: string
  accent?: string
  companyName?: string
  fields: Array<{ key: string; label: string; type: string }>
  rows: SubmissionRow[]
}

export default function RentalFilledRegistrationsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [registering, setRegistering] = useState(false)
  const [regAnswers, setRegAnswers] = useState<Record<string, string | boolean>>({})
  const [regCustomerName, setRegCustomerName] = useState('')
  const [q, setQ] = useState('')
  const [showDiscarded, setShowDiscarded] = useState(() => searchParams.get('discarded') === '1')
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data: forms = [] } = useQuery({
    queryKey: ['rental-registration-forms'],
    queryFn: () => rentalApi.listRegistrationForms() as Promise<RegistrationFormRecord[]>,
  })
  const { data: submissions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['rental-registration-submissions', showDiscarded ? 'discarded' : 'active'],
    queryFn: () =>
      rentalApi.listRegistrationSubmissions({ deleted_only: showDiscarded }) as Promise<SubmissionRow[]>,
  })

  const formsById = useMemo(() => {
    const m = new Map<string, RegistrationFormRecord>()
    for (const f of forms) m.set(f.id, f)
    return m
  }, [forms])

  const storefrontForm = useMemo(
    () => forms.find((f) => f.use_on_storefront && f.status === 'published') || null,
    [forms],
  )

  const filteredSubs = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return submissions
    return submissions.filter((s) => {
      const hay = [
        s.customer_name,
        s.form_name,
        s.booking_number,
        s.channel,
        formsById.get(s.form_id || '')?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [submissions, q, formsById])

  const folders = useMemo((): FolderGroup[] => {
    const map = new Map<string, FolderGroup>()
    for (const row of filteredSubs) {
      const form = row.form_id ? formsById.get(row.form_id) : undefined
      const id = row.form_id || `__unnamed__:${row.form_name || 'Registration form'}`
      const name = form?.name || row.form_name || 'Registration form'
      let folder = map.get(id)
      if (!folder) {
        folder = {
          id,
          name,
          accent: form?.theme?.accent,
          companyName: form?.theme?.company_name,
          fields: (row.fields?.length ? row.fields : form?.fields) || [],
          rows: [],
        }
        map.set(id, folder)
      }
      folder.rows.push(row)
      if (!folder.fields.length) {
        folder.fields = (row.fields?.length ? row.fields : form?.fields) || []
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredSubs, formsById])

  const openFolder = useMemo(
    () => (openFolderId ? folders.find((f) => f.id === openFolderId) || null : null),
    [folders, openFolderId],
  )

  const selectedRow = useMemo(() => {
    if (!selectedId || !openFolder) return null
    return openFolder.rows.find((r) => r.id === selectedId) || null
  }, [selectedId, openFolder])

  const submitCustomer = useMutation({
    mutationFn: async () => {
      if (!storefrontForm) throw new Error('No storefront form')
      const missing = (storefrontForm.fields || []).filter((f) => {
        if (f.type === 'heading' || !f.required) return false
        const v = regAnswers[f.key]
        return f.type === 'checkbox' || f.type === 'terms' ? v !== true : !String(v ?? '').trim()
      })
      if (missing.length) throw new Error(`Please fill: ${missing.map((f) => f.label).join(', ')}`)
      return rentalApi.createRegistrationSubmission({
        form_id: storefrontForm.id,
        customer_name: regCustomerName.trim() || undefined,
        answers: regAnswers,
      })
    },
    onSuccess: () => {
      toast.success('Customer registration saved')
      setRegistering(false)
      setRegAnswers({})
      setRegCustomerName('')
      qc.invalidateQueries({ queryKey: ['rental-registration-submissions'] })
      qc.invalidateQueries({ queryKey: ['rental-registration-forms'] })
    },
    onError: (e) => toast.error(extractApiError(e, e instanceof Error ? e.message : 'Could not save registration')),
  })

  const restoreSubmission = useMutation({
    mutationFn: (id: string) => rentalApi.restoreRegistrationSubmission(id),
    onSuccess: (row: SubmissionRow) => {
      toast.success(
        row.booking_id
          ? 'Registration restored on the booking (any current form was moved to Discarded)'
          : 'Registration restored',
      )
      setSelectedId((cur) => (cur === row.id ? null : cur))
      qc.invalidateQueries({ queryKey: ['rental-registration-submissions'] })
      qc.invalidateQueries({ queryKey: ['rental-registration-forms'] })
      if (row.booking_id) {
        qc.invalidateQueries({ queryKey: ['rental-booking', row.booking_id] })
      }
    },
    onError: (e) => toast.error(extractApiError(e, 'Restore registration')),
  })

  async function downloadPdf(row: SubmissionRow, folder: FolderGroup) {
    const key = `pdf:${row.id}`
    setDownloadingId(key)
    try {
      const form = row.form_id ? formsById.get(row.form_id) : undefined
      const html = buildRegistrationHtml(
        {
          ...row,
          form_name: row.form_name || folder.name,
          fields: row.fields?.length ? row.fields : folder.fields,
        },
        { accent: folder.accent || form?.theme?.accent, companyName: folder.companyName },
      )
      await downloadAsPdf(html, registrationFileName(row, 'pdf'), { margin: 8 })
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(extractApiError(e, 'Could not download PDF'))
    } finally {
      setDownloadingId(null)
    }
  }

  function downloadCsv(row: SubmissionRow, folder: FolderGroup) {
    const fields = row.fields?.length ? row.fields : folder.fields
    const csv = buildRegistrationCsv(
      [{ ...row, form_name: row.form_name || folder.name, fields }],
      fields,
    )
    downloadBlob(csv, registrationFileName(row, 'csv'), 'text/csv;charset=utf-8;')
    toast.success('CSV downloaded')
  }

  function downloadFolderCsv(folder: FolderGroup) {
    const fields = folder.fields
    const csv = buildRegistrationCsv(
      folder.rows.map((r) => ({
        ...r,
        form_name: r.form_name || folder.name,
        fields: r.fields?.length ? r.fields : fields,
      })),
      fields,
    )
    const name = `${folder.name.replace(/[^\w.\- ]+/g, '_').trim() || 'registrations'}.csv`
    downloadBlob(csv, name, 'text/csv;charset=utf-8;')
    toast.success(`Downloaded ${folder.rows.length} registration${folder.rows.length === 1 ? '' : 's'}`)
  }

  function resetBrowse() {
    setOpenFolderId(null)
    setSelectedId(null)
  }

  const setDiscardedView = (next: boolean) => {
    setShowDiscarded(next)
    setRegistering(false)
    setQ('')
    resetBrowse()
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev)
      if (next) np.set('discarded', '1')
      else np.delete('discarded')
      return np
    }, { replace: true })
  }

  function openEdit(row: SubmissionRow) {
    if (!row.booking_id) {
      toast.error('This registration is not linked to a booking, so it can only be restored.')
      return
    }
    const params = showDiscarded
      ? `registration=edit&from=${encodeURIComponent(row.id)}`
      : 'registration=edit'
    navigate(`/rental/bookings/${row.booking_id}?${params}`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {showDiscarded ? 'Discarded registrations' : 'Filled registrations'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {showDiscarded
                ? 'Soft-discarded guest answers kept for history. Restore anytime — nothing is permanently erased.'
                : 'Browse by form folder, open a file, and download PDF or CSV.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={showDiscarded ? 'default' : 'outline'}
            onClick={() => setDiscardedView(!showDiscarded)}
          >
            <Trash2 className={cn('mr-1 h-4 w-4', !showDiscarded && 'text-red-500')} />
            {showDiscarded ? 'Back to active' : 'Discarded'}
          </Button>
          {!showDiscarded && storefrontForm && (
            <Button
              size="sm"
              onClick={() => {
                setRegistering((open) => !open)
                setRegAnswers({})
                setRegCustomerName('')
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Register customer details
            </Button>
          )}
        </div>
      </div>

      {!showDiscarded && storefrontForm && registering && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Register customer — {storefrontForm.name}</h3>
          <div>
            <FieldLabel>Customer name</FieldLabel>
            <Input
              value={regCustomerName}
              onChange={(e) => setRegCustomerName(e.target.value)}
              placeholder="Name to show in this list"
            />
          </div>
          <RegistrationFormFields
            fields={storefrontForm.fields || []}
            values={regAnswers}
            theme={storefrontForm.theme}
            onUploadImage={async (file) => (await rentalApi.uploadRegistrationImage(file)).url}
            onChange={(key, value) => setRegAnswers((prev) => ({ ...prev, [key]: value }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => submitCustomer.mutate()} disabled={submitCustomer.isPending}>
              {submitCustomer.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Save registration
            </Button>
            <Button variant="outline" onClick={() => setRegistering(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, form, booking…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              resetBrowse()
            }}
          />
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button
          type="button"
          className={cn(
            'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',
            !openFolder && 'font-medium text-foreground',
          )}
          onClick={resetBrowse}
        >
          All forms
        </button>
        {openFolder ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <button
              type="button"
              className={cn(
                'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',
                !selectedRow && 'font-medium text-foreground',
              )}
              onClick={() => setSelectedId(null)}
            >
              {openFolder.name}
            </button>
          </>
        ) : null}
        {selectedRow ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate px-1.5 font-medium text-foreground">
              {selectedRow.customer_name || 'Guest'}
            </span>
          </>
        ) : null}
      </nav>

      {loadingSubs ? (
        <p className="text-sm text-muted-foreground">
          {showDiscarded ? 'Loading discarded registrations…' : 'Loading filled registrations…'}
        </p>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {showDiscarded ? 'No discarded registrations' : 'No filled registrations yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {showDiscarded
              ? 'When you discard a guest registration on a booking (or replace it), it appears here. Restore it, or open Edit to change answers on the booking.'
              : (
                <>
                  Submissions appear here when customers fill a storefront form, staff complete registration on a booking, or you register customer details.
                  Create or enable a form under{' '}
                  <Link to="/rental/registration-forms" className="font-medium text-primary underline-offset-2 hover:underline">
                    Registration Forms
                  </Link>
                  .
                </>
              )}
          </p>
        </div>
      ) : folders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No registrations match your search.
        </p>
      ) : !openFolder ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Folder className="h-3.5 w-3.5" />
            Form folders
            <span className="ml-auto font-normal normal-case tracking-normal">
              {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {folders.map((folder) => (
              <li key={folder.id}>
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/50"
                    onClick={() => {
                      setOpenFolderId(folder.id)
                      setSelectedId(null)
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      <FolderOpen className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{folder.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {folder.rows.length} {folder.rows.length === 1 ? 'file' : 'files'}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                  <div className="flex shrink-0 items-center pr-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Download folder as CSV"
                      onClick={() => downloadFolderCsv(folder)}
                    >
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                      CSV
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {openFolder.name}
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => downloadFolderCsv(openFolder)}>
                <Download className="mr-1 h-3 w-3" />
                All CSV
              </Button>
            </div>
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
              {openFolder.rows.map((row) => {
                const active = selectedId === row.id
                const pdfBusy = downloadingId === `pdf:${row.id}`
                return (
                  <li key={row.id} className={cn(active && 'bg-primary/5')}>
                    <div className="flex items-stretch gap-0.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-muted/40"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/12 text-sky-700 dark:text-sky-400">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {row.customer_name || 'Guest'}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.booking_number ? `${row.booking_number} · ` : ''}
                            {showDiscarded && row.deleted_at
                              ? `Discarded ${new Date(row.deleted_at).toLocaleString('en-IN')}`
                              : row.created_at
                                ? new Date(row.created_at).toLocaleString('en-IN')
                                : '—'}
                            {row.channel ? ` · ${row.channel}` : ''}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 pr-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          title="Download PDF"
                          disabled={pdfBusy}
                          onClick={() => downloadPdf(row, openFolder)}
                        >
                          {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          title="Download CSV"
                          onClick={() => downloadCsv(row, openFolder)}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </Button>
                        {showDiscarded && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            title="Restore"
                            disabled={restoreSubmission.isPending && restoreSubmission.variables === row.id}
                            onClick={() => restoreSubmission.mutate(row.id)}
                          >
                            {restoreSubmission.isPending && restoreSubmission.variables === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {row.booking_id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            title={showDiscarded ? 'Edit on booking' : 'Edit on booking'}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="min-w-0">
            {selectedRow ? (
              <RegistrationAnswersPanel
                formName={selectedRow.form_name || openFolder.name}
                fields={selectedRow.fields?.length ? selectedRow.fields : openFolder.fields}
                answers={selectedRow.answers}
                channel={selectedRow.channel}
                accent={openFolder.accent}
                actions={(
                  <>
                    {showDiscarded && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={restoreSubmission.isPending && restoreSubmission.variables === selectedRow.id}
                        onClick={() => restoreSubmission.mutate(selectedRow.id)}
                      >
                        {restoreSubmission.isPending && restoreSubmission.variables === selectedRow.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 h-3 w-3" />
                        )}
                        Restore
                      </Button>
                    )}
                    {selectedRow.booking_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openEdit(selectedRow)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={downloadingId === `pdf:${selectedRow.id}`}
                      onClick={() => downloadPdf(selectedRow, openFolder)}
                    >
                      {downloadingId === `pdf:${selectedRow.id}` ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-3 w-3" />
                      )}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => downloadCsv(selectedRow, openFolder)}
                    >
                      <FileSpreadsheet className="mr-1 h-3 w-3" />
                      CSV
                    </Button>
                  </>
                )}
              />
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Select a file to preview answers, or download from the list.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
