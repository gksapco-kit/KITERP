import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { pharmaApi } from '@/api/pharma'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { MasterDataPicker, type PickerOption } from '@/components/commission/MasterDataPicker'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  PharmaBatchSelect,
  PharmaCard,
  PharmaEmpty,
  PharmaESignDialog,
  PharmaLoading,
  PharmaPageHeader,
  PharmaStatusBadge,
  PharmaToolbar,
  isUuid,
  type PharmaESignPayload,
} from './pharmaShared'

const VERIFY_REASONS: Record<string, string> = {
  verified_local: 'Serial found in your registry and matches the checks you entered.',
  serial_not_found: 'No serial with that number exists yet. Commission it under Serialization first.',
  serial_destroyed: 'This serial was decommissioned or destroyed and is not saleable.',
  serial_recalled: 'This serial is under recall and must not be sold.',
  gtin_mismatch: 'The GTIN you entered does not match the product on this serial.',
  lot_mismatch: 'The lot you entered does not match the batch linked to this serial.',
}

const BIZ_STEP_LABELS: Record<string, string> = {
  commissioning: 'Commissioned',
  packing: 'Packed / aggregated',
  shipping: 'Shipped',
  receiving: 'Received / returned to active',
  destroying: 'Destroyed / decommissioned',
  recalling: 'Recalled',
}

function shortEpc(epc: string): string {
  if (!epc) return '—'
  const parts = epc.split(':')
  const last = parts[parts.length - 1] || epc
  return last.length > 28 ? `${last.slice(0, 12)}…${last.slice(-8)}` : last
}

export function PharmaGdpPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    goods_batch_id: '',
    temp_c: '',
    duration_minutes: '',
    severity: 'minor',
    notes: '',
  })
  const [licenseCustomerId, setLicenseCustomerId] = useState('')
  const [licenseResult, setLicenseResult] = useState<any>(null)
  const [licenseChecking, setLicenseChecking] = useState(false)
  const [customerOptions, setCustomerOptions] = useState<{ value: string; label: string }[]>([])

  const load = () => {
    setLoading(true)
    pharmaApi.listExcursions().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed to load excursions')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    vendorApi
      .listCustomers?.({ limit: 200 })
      .then((r: any) => {
        const customers = r?.items || r?.customers || []
        setCustomerOptions([
          { value: '', label: 'Select customer…' },
          ...customers.map((c: any) => ({ value: c.id, label: c.name || c.company_name || c.id })),
        ])
      })
      .catch(() => {})
  }, [])

  const openCount = items.filter((e) => e.status === 'open' || e.status === 'investigating').length

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="GDP / cold chain"
        subtitle="Record temperature excursions on lots, investigate, and close. Product cold-chain flags live in Foundations; SLoc bands in Storage locations."
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-2 py-1">
          Open / investigating: <strong className="text-foreground">{openCount}</strong>
        </span>
        <Link to="/pharma/settings" className="rounded-md bg-muted px-2 py-1 hover:text-foreground">
          Product cold-chain flags →
        </Link>
        <Link to="/storage-locations" className="rounded-md bg-muted px-2 py-1 hover:text-foreground">
          Storage location bands →
        </Link>
      </div>

      {canManage ? (
        <PharmaCard className="mb-4">
          <h2 className="mb-1 text-sm font-medium">Log excursion</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Use when a fridge, freezer, or CRT area goes outside the allowed band.
          </p>
          <PharmaToolbar>
            <PharmaBatchSelect
              className="w-72"
              value={form.goods_batch_id}
              onChange={(goods_batch_id) => setForm({ ...form, goods_batch_id })}
            />
            <Input
              className="w-28"
              type="number"
              step="0.1"
              placeholder="Temp °C"
              value={form.temp_c}
              onChange={(e) => setForm({ ...form, temp_c: e.target.value })}
            />
            <Input
              className="w-28"
              type="number"
              placeholder="Minutes"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            />
            <Select
              value={form.severity}
              onChange={(severity) => setForm({ ...form, severity })}
              options={[
                { value: 'minor', label: 'Minor' },
                { value: 'major', label: 'Major' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <Input
              className="w-56"
              placeholder="What happened?"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <Button
              onClick={() => {
                if (!isUuid(form.goods_batch_id) || form.temp_c === '') {
                  toast.error('Select a batch and enter temperature')
                  return
                }
                pharmaApi
                  .createExcursion({
                    goods_batch_id: form.goods_batch_id,
                    temp_c: Number(form.temp_c),
                    duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
                    severity: form.severity,
                    notes: form.notes || undefined,
                  })
                  .then(() => {
                    toast.success('Excursion logged')
                    setForm({ ...form, temp_c: '', notes: '', duration_minutes: '' })
                    load()
                  })
                  .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed'))
              }}
            >
              Log excursion
            </Button>
          </PharmaToolbar>
        </PharmaCard>
      ) : null}

      {canManage ? (
        <PharmaCard className="mb-4">
          <h2 className="mb-1 text-sm font-medium">Import from sensor logger (CSV)</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            CSV columns: <span className="font-mono">recorded_at, temp_c, duration_minutes, severity, notes, storage_location_id, goods_batch_id</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              className="text-sm"
              onChange={(ev) => {
                const file = ev.target.files?.[0]
                if (!file) return
                pharmaApi
                  .importExcursionsCsv(file)
                  .then((r: any) => {
                    if (r.created > 0) {
                      toast.success(`Imported ${r.created} excursion(s)`)
                      load()
                    } else {
                      toast.error('No rows imported')
                    }
                    if (r.errors?.length) {
                      toast.error(`${r.errors.length} row(s) had errors — check console`)
                      console.warn('Excursion import errors:', r.errors)
                    }
                    ev.target.value = ''
                  })
                  .catch((e: any) => toast.error(e?.response?.data?.detail || 'Import failed'))
              }}
            />
          </div>
        </PharmaCard>
      ) : null}

      <PharmaCard className="mb-4">
        <h2 className="mb-3 text-sm font-medium">Excursion log</h2>
        {loading ? (
          <PharmaLoading />
        ) : items.length === 0 ? (
          <PharmaEmpty
            label="No excursions recorded"
            hint="When a cold-chain deviation happens, log it here against the affected lot."
          />
        ) : null}
        <ul className="divide-y divide-border/60">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <div className="font-medium">
                  {e.temp_c}°C
                  {e.duration_minutes != null ? ` for ${e.duration_minutes} min` : ''}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <PharmaStatusBadge status={e.status} />
                  <PharmaStatusBadge status={e.severity} />
                  <span className="text-xs text-muted-foreground">
                    {e.recorded_at?.replace?.('T', ' ').slice?.(0, 16) || '—'}
                  </span>
                </div>
                {e.notes ? <p className="mt-1 max-w-xl text-xs text-muted-foreground">{e.notes}</p> : null}
              </div>
              {e.status !== 'closed' && canManage ? (
                <div className="flex gap-1">
                  {e.status === 'open' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        pharmaApi
                          .updateExcursion(e.id, { status: 'investigating', action: 'Investigation started' })
                          .then(load)
                      }
                    >
                      Investigate
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() =>
                      pharmaApi
                        .updateExcursion(e.id, { status: 'closed', action: 'Closed' })
                        .then(() => {
                          toast.success('Excursion closed')
                          load()
                        })
                    }
                  >
                    Close
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </PharmaCard>

      <PharmaCard>
        <h2 className="mb-1 text-sm font-medium">Wholesale license check</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Verify a customer's wholesale distributor license before shipping. Enable the gate in{' '}
          <Link to="/pharma/settings" className="text-primary hover:underline">Foundations</Link>{' '}
          to block shipments automatically when the license is expired or missing.
        </p>
        <PharmaToolbar>
          <Select
            className="w-72"
            value={licenseCustomerId}
            onChange={setLicenseCustomerId}
            options={customerOptions}
            placeholder="Select customer…"
          />
          <Button
            disabled={!licenseCustomerId || licenseChecking}
            onClick={async () => {
              if (!licenseCustomerId) return
              setLicenseChecking(true)
              setLicenseResult(null)
              try {
                const res = await pharmaApi.checkWholesaleLicense(licenseCustomerId)
                setLicenseResult(res)
              } catch (e: any) {
                toast.error(e?.response?.data?.detail || 'License check failed')
              } finally {
                setLicenseChecking(false)
              }
            }}
          >
            {licenseChecking ? 'Checking…' : 'Check license'}
          </Button>
        </PharmaToolbar>
        {licenseResult ? (
          <div
            className={`mt-2 rounded-md border px-4 py-3 text-sm ${
              licenseResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">{licenseResult.ok ? 'License valid' : 'License invalid or missing'}</div>
            {licenseResult.license_number ? (
              <div className="mt-1 text-xs opacity-80">
                License: {licenseResult.license_number}
                {licenseResult.license_expires ? ` · expires ${licenseResult.license_expires}` : ''}
              </div>
            ) : null}
            {!licenseResult.ok && licenseResult.detail ? (
              <div className="mt-1 text-xs opacity-80">{licenseResult.detail}</div>
            ) : null}
            {!licenseResult.enforced ? (
              <div className="mt-1 text-xs opacity-60 italic">Gate not enforced — enable "Block ship without valid wholesale license" in Foundations.</div>
            ) : null}
          </div>
        ) : null}
      </PharmaCard>
    </div>
  )
}

export function PharmaTrackTracePage() {
  const canManage = useHasPermission('pharma.manage')
  const [events, setEvents] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [serials, setSerials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [partnerForm, setPartnerForm] = useState({
    partner_type: 'wholesaler',
    gln: '',
    license_number: '',
  })
  /** Master-data role filter before search: customer | vendor | other */
  const [masterKind, setMasterKind] = useState<'customer' | 'vendor' | 'other'>('customer')
  const [selectedMaster, setSelectedMaster] = useState<PickerOption | null>(null)
  const [verify, setVerify] = useState({ serial_number: '', gtin: '', lot_number: '' })
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)
  const [fmdSerialId, setFmdSerialId] = useState('')
  const [signOpen, setSignOpen] = useState(false)
  const [region, setRegion] = useState('none')
  const [stepFilter, setStepFilter] = useState('')
  const [exportFormat, setExportFormat] = useState<'json' | 'xml' | 'csv' | 'xlsx' | 'pdf'>('json')

  const downloadPartnerExport = () => {
    const labels: Record<typeof exportFormat, string> = {
      json: 'EPCIS JSON',
      xml: 'EPCIS XML',
      csv: 'CSV spreadsheet',
      xlsx: 'Excel workbook',
      pdf: 'PDF report',
    }
    const filenames: Record<typeof exportFormat, string> = {
      json: 'epcis-export.json',
      xml: 'epcis-export.xml',
      csv: 'epcis-movements.csv',
      xlsx: 'epcis-movements.xlsx',
      pdf: 'epcis-movements.pdf',
    }
    const mime: Record<typeof exportFormat, string> = {
      json: 'application/ld+json',
      xml: 'application/xml;charset=utf-8',
      csv: 'text/csv;charset=utf-8',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    }
    pharmaApi
      .exportEpcis({ limit: 500, format: exportFormat })
      .then((doc) => {
        let blob: Blob
        let toastMsg = `Downloaded ${labels[exportFormat]}`
        if (exportFormat === 'json') {
          const count = doc?.meta?.count ?? doc?.epcisBody?.eventList?.length ?? 0
          blob = new Blob([JSON.stringify(doc, null, 2)], { type: mime.json })
          toastMsg = `Downloaded ${count} events (EPCIS JSON) for partners`
        } else if (doc instanceof Blob) {
          blob = doc
        } else {
          blob = new Blob([typeof doc === 'string' ? doc : String(doc)], { type: mime[exportFormat] })
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filenames[exportFormat]
        a.click()
        URL.revokeObjectURL(url)
        toast.success(toastMsg)
      })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Export failed'))
  }

  const load = async () => {
    setLoading(true)
    try {
      const [ev, pt, settings, sn] = await Promise.all([
        pharmaApi.listEpcisEvents({ limit: 100 }),
        pharmaApi.listPartners(),
        pharmaApi.getSettings(),
        pharmaApi.listSerials(),
      ])
      setEvents(ev.items || [])
      setPartners(pt.items || [])
      setRegion(settings.track_trace_region || 'none')
      setSerials(sn.items || [])
    } catch {
      toast.error('Failed to load track & trace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredEvents = stepFilter
    ? events.filter((e) => e.biz_step === stepFilter)
    : events

  const runVerify = () => {
    if (!verify.serial_number.trim()) {
      toast.error('Enter a serial number')
      return
    }
    setVerifying(true)
    pharmaApi
      .dscsaVerify({
        serial_number: verify.serial_number.trim(),
        gtin: verify.gtin.trim() || undefined,
        lot_number: verify.lot_number.trim() || undefined,
      })
      .then((r) => {
        setVerifyResult(r)
        if (r.verified) toast.success('Verified')
        else toast.message(r.message || 'Not verified')
      })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Verify failed'))
      .finally(() => setVerifying(false))
  }

  const setRegionInline = (next: string) => {
    pharmaApi
      .patchSettings({ track_trace_region: next })
      .then((s) => {
        setRegion(s.track_trace_region || next)
        toast.success(
          next === 'eu'
            ? 'EU FMD tools enabled'
            : next === 'us'
              ? 'US DSCSA region set'
              : 'Track region cleared',
        )
      })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Could not update region'))
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Track & trace"
        subtitle="Verify serials before saleable returns, manage trading partners, and review the EPCIS movement timeline."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Regulatory region</span>
        <Select
          value={region}
          onChange={setRegionInline}
          options={[
            { value: 'none', label: 'Not set' },
            { value: 'us', label: 'US — DSCSA' },
            { value: 'eu', label: 'EU — FMD' },
          ]}
        />
        <Link to="/pharma/settings" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          GTIN / NDC on products
        </Link>
        <Link to="/pharma/serialization" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Commission serials
        </Link>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <PharmaCard>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Verify serial (saleable return)</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              verifyResult?.partner_call === 'live'
                ? 'bg-emerald-100 text-emerald-800'
                : verifyResult?.partner_call === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {verifyResult?.partner_call === 'live'
                ? 'VRS live'
                : verifyResult?.partner_call === 'error'
                  ? 'VRS error — local fallback'
                  : 'Local registry'}
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Checks against serials in KITERP. Configure a VRS endpoint in Foundations to also query
            your DSCSA Verification Router Service.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-40"
              placeholder="Serial number"
              value={verify.serial_number}
              onChange={(e) => setVerify({ ...verify, serial_number: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && runVerify()}
            />
            <Input
              className="w-36"
              placeholder="GTIN (optional)"
              value={verify.gtin}
              onChange={(e) => setVerify({ ...verify, gtin: e.target.value })}
            />
            <Input
              className="w-36"
              placeholder="Lot (optional)"
              value={verify.lot_number}
              onChange={(e) => setVerify({ ...verify, lot_number: e.target.value })}
            />
            <Button onClick={runVerify} disabled={verifying}>
              {verifying ? 'Checking…' : 'Verify'}
            </Button>
          </div>

          {verifyResult ? (
            <div
              className={`mt-4 rounded-md border p-3 ${
                verifyResult.verified
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : 'border-amber-200 bg-amber-50/80'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {verifyResult.verified ? 'Verified' : 'Not verified'}
                </span>
                {verifyResult.serial_status ? (
                  <PharmaStatusBadge status={verifyResult.serial_status} />
                ) : null}
              </div>
              <p className="mt-1.5 text-sm text-foreground/90">
                {VERIFY_REASONS[verifyResult.reason] || verifyResult.message || 'Check the serial and try again.'}
              </p>
              <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-foreground/70">Serial</dt>
                  <dd className="font-mono">{verifyResult.serial_number || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground/70">GTIN checked</dt>
                  <dd className="font-mono">{verifyResult.gtin || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground/70">Lot checked</dt>
                  <dd className="font-mono">{verifyResult.lot_number || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground/70">Result code</dt>
                  <dd>{(verifyResult.reason || '—').replace(/_/g, ' ')}</dd>
                </div>
              </dl>
              {verifyResult.partner_call === 'live' ? (
                <div className="mt-2 rounded bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">
                  Verified via VRS + local registry
                </div>
              ) : verifyResult.partner_call === 'error' ? (
                <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                  VRS unreachable — result is local-only. Check VRS credentials in Foundations.
                </div>
              ) : (
                <div className="mt-2 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  Local registry only. Configure a VRS endpoint in Foundations for DSCSA network verification.
                </div>
              )}
              {!verifyResult.verified && verifyResult.reason === 'serial_not_found' ? (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link to="/pharma/serialization">Open Serialization</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Enter a serial from a package or return and press Verify.
            </p>
          )}
        </PharmaCard>

        <PharmaCard>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="mb-1 text-sm font-medium">Trading partners</h2>
              <p className="text-xs text-muted-foreground">
                Choose the Master Data type first, then search and add the trading partner.
              </p>
            </div>
            <Link
              to="/master-data/new"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Add in Master Data
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {canManage ? (
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Master type</span>
              <Select
                value={masterKind}
                onChange={(next) => {
                  setMasterKind(next as 'customer' | 'vendor' | 'other')
                  setSelectedMaster(null)
                  setPartnerForm((f) => ({
                    ...f,
                    license_number: '',
                    partner_type:
                      next === 'vendor' ? 'manufacturer' : next === 'customer' ? 'dispenser' : 'wholesaler',
                  }))
                }}
                options={[
                  { value: 'customer', label: 'Customer' },
                  { value: 'vendor', label: 'Vendor' },
                  { value: 'other', label: 'Other (partner / contractor)' },
                ]}
              />
            </div>
            <MasterDataPicker
              key={masterKind}
              placeholder={
                masterKind === 'customer'
                  ? 'Search customers by name, email or phone…'
                  : masterKind === 'vendor'
                    ? 'Search vendors / suppliers by name, email or phone…'
                    : 'Search partners, contractors and other parties…'
              }
              selected={selectedMaster}
              onSearch={async (q) => {
                if (masterKind === 'customer') {
                  const customers = await vendorApi.listCustomers({ search: q, size: 20 })
                  return (customers?.items || []).map((c: any) => ({
                    id: `cust:${c.id}`,
                    label: c.company_name || c.full_name,
                    sub: ['Customer', c.phone, c.email, c.wholesale_license_number]
                      .filter(Boolean)
                      .join(' • '),
                    phone: c.phone ?? undefined,
                    email: c.email ?? undefined,
                    meta: { source: 'customer' as const, id: c.id, record: c },
                  }))
                }
                if (masterKind === 'vendor') {
                  const [bps, suppliers] = await Promise.all([
                    vendorApi.listBusinessPartners({ search: q, role: 'vendor', size: 15 }),
                    vendorApi.listSuppliers({ search: q, size: 15 }),
                  ])
                  const bpOpts: PickerOption[] = (bps?.items || []).map((bp) => ({
                    id: `bp:${bp.id}`,
                    label: bp.name,
                    sub: ['Vendor', bp.phone, bp.email].filter(Boolean).join(' • '),
                    phone: bp.phone ?? undefined,
                    email: bp.email ?? undefined,
                    meta: { source: 'bp' as const, id: bp.id, record: bp },
                  }))
                  const seen = new Set(bpOpts.map((o) => o.label.toLowerCase()))
                  const supplierOpts: PickerOption[] = (suppliers?.items || [])
                    .filter((s) => !seen.has((s.name || '').toLowerCase()))
                    .map((s) => ({
                      id: `sup:${s.id}`,
                      label: s.name,
                      sub: ['Supplier', s.phone, s.email].filter(Boolean).join(' • '),
                      phone: s.phone ?? undefined,
                      email: s.email ?? undefined,
                      meta: { source: 'supplier' as const, id: s.id, record: s },
                    }))
                  return [...bpOpts, ...supplierOpts].slice(0, 25)
                }
                // other — partner / contractor / remaining business partners
                const [partners, contractors] = await Promise.all([
                  vendorApi.listBusinessPartners({ search: q, role: 'partner', size: 12 }),
                  vendorApi.listBusinessPartners({ search: q, role: 'contractor', size: 12 }),
                ])
                const byId = new Map<string, PickerOption>()
                for (const bp of [...(partners?.items || []), ...(contractors?.items || [])]) {
                  const roles = (bp.roles || []).map((r) => r.role).filter(Boolean).join(', ')
                  byId.set(bp.id, {
                    id: `bp:${bp.id}`,
                    label: bp.name,
                    sub: [roles || 'Other', bp.phone, bp.email].filter(Boolean).join(' • '),
                    phone: bp.phone ?? undefined,
                    email: bp.email ?? undefined,
                    meta: { source: 'bp' as const, id: bp.id, record: bp },
                  })
                }
                return Array.from(byId.values()).slice(0, 25)
              }}
              onSelect={(opt) => {
                setSelectedMaster(opt)
                if (!opt?.meta) return
                const meta = opt.meta as {
                  source: 'bp' | 'customer' | 'supplier'
                  id: string
                  record: any
                }
                if (meta.source === 'customer') {
                  const c = meta.record
                  setPartnerForm((f) => ({
                    ...f,
                    license_number: c.wholesale_license_number || f.license_number,
                  }))
                } else if (meta.source === 'bp') {
                  const bp = meta.record
                  const custRole = (bp.roles || []).find((r: any) => r.role === 'customer' && r.customer_id)
                  if (custRole?.customer_id) {
                    vendorApi
                      .getCustomer(custRole.customer_id)
                      .then((c) => {
                        if (c?.wholesale_license_number) {
                          setPartnerForm((f) => ({
                            ...f,
                            license_number: c.wholesale_license_number || '',
                          }))
                        }
                      })
                      .catch(() => {})
                  }
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Select
                value={partnerForm.partner_type}
                onChange={(partner_type) => setPartnerForm({ ...partnerForm, partner_type })}
                options={[
                  { value: 'wholesaler', label: 'Wholesaler' },
                  { value: 'dispenser', label: 'Dispenser' },
                  { value: 'manufacturer', label: 'Manufacturer' },
                ]}
              />
              <Input
                className="w-36"
                placeholder="GLN (optional)"
                value={partnerForm.gln}
                onChange={(e) => setPartnerForm({ ...partnerForm, gln: e.target.value })}
              />
              <Input
                className="w-40"
                placeholder="License # (optional)"
                value={partnerForm.license_number}
                onChange={(e) => setPartnerForm({ ...partnerForm, license_number: e.target.value })}
              />
              <Button
                onClick={() => {
                  if (!selectedMaster?.meta) {
                    toast.error('Select a partner from Master Data')
                    return
                  }
                  const meta = selectedMaster.meta as {
                    source: 'bp' | 'customer' | 'supplier'
                    id: string
                  }
                  const link =
                    meta.source === 'customer'
                      ? { customer_id: meta.id }
                      : meta.source === 'supplier'
                        ? { supplier_id: meta.id }
                        : { business_partner_id: meta.id }
                  pharmaApi
                    .createPartner({
                      name: selectedMaster.label,
                      partner_type: partnerForm.partner_type,
                      gln: partnerForm.gln.trim() || undefined,
                      license_number: partnerForm.license_number.trim() || undefined,
                      ...link,
                    })
                    .then(() => {
                      toast.success('Partner added')
                      setPartnerForm({
                        partner_type:
                          masterKind === 'vendor'
                            ? 'manufacturer'
                            : masterKind === 'customer'
                              ? 'dispenser'
                              : 'wholesaler',
                        gln: '',
                        license_number: '',
                      })
                      setSelectedMaster(null)
                      load()
                    })
                    .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed'))
                }}
              >
                Add partner
              </Button>
            </div>
          </div>
          ) : null}
          {partners.length === 0 ? (
            <PharmaEmpty
              label="No trading partners yet"
              hint="Choose Customer, Vendor, or Other, then search Master Data."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">GLN</th>
                    <th className="py-2 font-medium">License</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">
                        {p.name}
                        {p.meta?.business_partner_id || p.meta?.customer_id || p.meta?.supplier_id ? (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            Master Data
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        <PharmaStatusBadge status={p.partner_type} />
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.gln || '—'}</td>
                      <td className="py-2 text-xs">{p.license_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {region === 'eu' && canManage ? (
            <div className="mt-4 border-t border-border/60 pt-3">
              <h3 className="mb-1 text-sm font-medium">EU FMD decommission</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Marks a serial destroyed after supply and writes an EPCIS event. Requires e-sign.
              </p>
              <PharmaToolbar>
                <Select
                  value={fmdSerialId}
                  onChange={setFmdSerialId}
                  options={[
                    { value: '', label: 'Select active serial…' },
                    ...serials
                      .filter((s) => s.status === 'active' || s.status === 'shipped')
                      .map((s) => ({
                        value: s.id,
                        label: `${s.serial_number} (${s.status})`,
                      })),
                  ]}
                />
                <Button
                  variant="outline"
                  disabled={!fmdSerialId}
                  onClick={() => setSignOpen(true)}
                >
                  Decommission…
                </Button>
              </PharmaToolbar>
            </div>
          ) : region === 'eu' && !canManage ? (
            <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              FMD decommission requires <strong>pharma.manage</strong>.
            </p>
          ) : (
            <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Set region to <strong>EU — FMD</strong> above to enable decommission after supply.
            </p>
          )}
        </PharmaCard>
      </div>

      <PharmaCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Movement timeline</h2>
            <p className="text-xs text-muted-foreground">
              EPCIS events created when you commission, pack, ship, recall, or destroy serials.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={stepFilter}
              onChange={setStepFilter}
              options={[
                { value: '', label: 'All steps' },
                { value: 'commissioning', label: 'Commissioned' },
                { value: 'packing', label: 'Packed' },
                { value: 'shipping', label: 'Shipped' },
                { value: 'receiving', label: 'Received' },
                { value: 'recalling', label: 'Recalled' },
                { value: 'destroying', label: 'Destroyed' },
              ]}
            />
            <Select
              value={exportFormat}
              onChange={(v) => setExportFormat(v as typeof exportFormat)}
              options={[
                { value: 'json', label: 'EPCIS JSON (partners)' },
                { value: 'xml', label: 'EPCIS XML (partners)' },
                { value: 'csv', label: 'CSV (spreadsheet)' },
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'pdf', label: 'PDF report' },
              ]}
            />
            <Button size="sm" variant="outline" onClick={downloadPartnerExport}>
              Download for partners
            </Button>
          </div>
        </div>

        {loading ? (
          <PharmaLoading />
        ) : filteredEvents.length === 0 ? (
          <PharmaEmpty
            label="No movements yet"
            hint="Commission or ship serials on the Serialization page — events appear here automatically."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {filteredEvents.map((ev) => {
              const epcs = ev.epc_list || []
              const children = ev.child_epcs || []
              return (
                <li key={ev.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {BIZ_STEP_LABELS[ev.biz_step] || (ev.biz_step || 'Event').replace(/_/g, ' ')}
                      </span>
                      {ev.disposition ? <PharmaStatusBadge status={ev.disposition} /> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ev.lot_number ? (
                        <span className="mr-2">
                          Lot <span className="font-mono text-foreground/80">{ev.lot_number}</span>
                        </span>
                      ) : null}
                      {ev.gtin ? (
                        <span className="mr-2">
                          GTIN <span className="font-mono text-foreground/80">{ev.gtin}</span>
                        </span>
                      ) : null}
                      <span>{ev.event_time?.replace?.('T', ' ').slice?.(0, 16) || '—'}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {epcs.slice(0, 4).map((epc: string, i: number) => (
                        <span
                          key={i}
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          title={epc}
                        >
                          {shortEpc(epc)}
                        </span>
                      ))}
                      {epcs.length > 4 ? (
                        <span className="text-[10px] text-muted-foreground">+{epcs.length - 4} more</span>
                      ) : null}
                      {children.length ? (
                        <span className="text-[10px] text-muted-foreground">
                          · {children.length} child unit{children.length === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </PharmaCard>

      <PharmaESignDialog
        open={signOpen}
        title="Sign FMD decommission"
        description="Confirms the pack was supplied and permanently marks the serial destroyed."
        defaultMeaning="approver"
        confirmLabel="Sign & decommission"
        onClose={() => setSignOpen(false)}
        onConfirm={async (payload: PharmaESignPayload) => {
          await pharmaApi.fmdDecommission({ serial_id: fmdSerialId, reason: 'supplied', ...payload })
          toast.success('Serial decommissioned')
          setFmdSerialId('')
          load()
        }}
      />
    </div>
  )
}
