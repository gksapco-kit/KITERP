import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Camera, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { extractApiError } from '@/lib/errorMessages'
import { amGet, useAssetPerms, type Row } from './api'
import { CheckinDialog, CheckoutDialog } from './dialogs'
import { PageHeader, Panel, StatusBadge, fmtDate } from './ui'
import { useQueryClient } from '@tanstack/react-query'

export default function ScanPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const perms = useAssetPerms()
  const [code, setCode] = useState('')
  const [asset, setAsset] = useState<Row | null>(null)
  const [camera, setCamera] = useState(false)
  const [dlg, setDlg] = useState<null | 'out' | 'in'>(null)
  const [busy, setBusy] = useState(false)

  const find = useCallback(async (value: string) => {
    const v = value.trim()
    if (!v) return
    setBusy(true)
    try {
      setAsset(await amGet<Row>('/lookup', { code: v }))
      setCode('')
    } catch (e) {
      setAsset(null)
      toast.error(extractApiError(e, 'No asset found for that code'))
    } finally { setBusy(false) }
  }, [])

  const refresh = () => { if (asset) { qc.invalidateQueries({ queryKey: ['am'] }); find(asset.asset_tag) } }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Scan & look up" subtitle="Scan a QR label or barcode, or type an asset tag or serial number." />
      <Panel>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); find(code) }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus className="pl-9" placeholder="Tag, barcode or serial" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !code.trim()}>Find</Button>
          <Button type="button" variant="outline" onClick={() => setCamera(true)} aria-label="Scan with camera"><Camera className="h-4 w-4" /></Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">A hardware barcode scanner works here too: click the box and scan.</p>
      </Panel>

      {asset ? (
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-sm font-semibold">{asset.asset_tag}</div>
              <div className="text-lg font-semibold">{asset.name}</div>
              <div className="text-sm text-muted-foreground">{[asset.category_name, asset.manufacturer, asset.model].filter(Boolean).join(' · ')}</div>
            </div>
            <StatusBadge value={asset.status} />
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Held by</dt><dd>{asset.employee_name || asset.department_name || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Location</dt><dd>{asset.location_name || asset.store_name || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Serial</dt><dd>{asset.serial_number || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Acquired</dt><dd>{fmtDate(asset.acquisition_date)}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => nav(`/assets/register/${asset.id}`)}>Open</Button>
            {perms.manage && asset.status === 'in_stock' ? <Button variant="outline" onClick={() => setDlg('out')}>Check out</Button> : null}
            {perms.manage && asset.status === 'assigned' ? <Button variant="outline" onClick={() => setDlg('in')}>Check in</Button> : null}
          </div>
        </Panel>
      ) : null}

      <BarcodeScannerModal open={camera} title="Scan asset label" onClose={() => setCamera(false)} onScan={(c) => { setCamera(false); find(c) }} />
      {dlg === 'out' && asset ? <CheckoutDialog asset={asset} onClose={() => { setDlg(null); refresh() }} /> : null}
      {dlg === 'in' && asset ? <CheckinDialog asset={asset} onClose={() => { setDlg(null); refresh() }} /> : null}
    </div>
  )
}
