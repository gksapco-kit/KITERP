import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { extractApiError } from '@/lib/errorMessages'
import { amSend, type Row } from './api'
import { DataTable, PageHeader, Panel, Pill } from './ui'
import { useQueryClient } from '@tanstack/react-query'

const COLUMNS = [
  'name', 'category', 'asset_tag', 'serial_number', 'barcode', 'manufacturer', 'model', 'condition', 'location',
  'acquisition_date', 'acquisition_cost', 'salvage_value', 'supplier_name', 'purchase_ref', 'description', 'notes',
]

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export default function AssetImport() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [file, setFile] = useState('')
  const [result, setResult] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)

  const template = () => {
    const sample = ['Dell Latitude 5440', 'Laptops', '', 'SN-12345', '', 'Dell', 'Latitude 5440', 'new', 'Head Office', '2025-04-01', '78000', '5000', 'Dell India', 'PO-1001', '', '']
    const blob = new Blob([`${COLUMNS.join(',')}\n${sample.join(',')}\n`], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'asset-import-template.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  }

  const run = async (data: Row[], dry: boolean) => {
    setBusy(true)
    try {
      const r = await amSend<Row>('post', '/import', { rows: data, dry_run: dry })
      setResult(r)
      if (!dry) {
        qc.invalidateQueries({ queryKey: ['am'] })
        toast.success(`Imported ${r.created} asset(s)${r.errors ? `, ${r.errors} row(s) skipped` : ''}`)
      }
    } catch (e) {
      toast.error(extractApiError(e, 'Import failed'))
    } finally { setBusy(false) }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    const table = parseCsv(await f.text())
    if (table.length < 2) return toast.error('The file has no data rows')
    const head = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
    if (!head.includes('name')) return toast.error('The first row must be a header that includes a "name" column')
    const data = table.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()]))) as Row[]
    if (data.length > 2000) return toast.error('Import at most 2000 rows at a time')
    setFile(f.name); setRows(data); setResult(null)
    run(data, true)
  }

  const failed = (result?.rows as Row[] | undefined)?.filter((r) => !r.ok) ?? []
  const committed = result && !result.dry_run

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Import assets" subtitle="Bring in an existing asset list from a spreadsheet saved as CSV."
        actions={<Button variant="outline" onClick={template}><Download className="h-4 w-4" /> Template</Button>} />

      <Panel title="1. Choose a file">
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => input.current?.click()} disabled={busy}><Upload className="h-4 w-4" /> Choose CSV</Button>
          {file ? <span className="text-sm text-muted-foreground">{file} · {rows.length} row(s)</span> : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Required column: <b>name</b>. Categories and locations are matched by name and created if they do not exist. Leave asset_tag blank to generate tags.</p>
      </Panel>

      {result ? (
        <Panel title={committed ? 'Result' : '2. Check and import'}>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Pill tone="green">{committed ? result.created : result.total - result.errors} OK</Pill>
            {result.errors ? <Pill tone="red">{result.errors} with errors</Pill> : null}
            {!committed ? <span className="text-muted-foreground">Nothing has been saved yet.</span> : null}
          </div>
          {failed.length ? (
            <DataTable rows={failed.slice(0, 200).map((r) => ({ ...r, id: String(r.row) }))} cols={[
              { key: 'row', header: 'Row', className: 'w-16' }, { key: 'error', header: 'Problem' },
            ]} />
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            {committed ? <Button onClick={() => nav('/assets/register')}>Go to register</Button> : (
              <Button disabled={busy || result.total - result.errors === 0} onClick={() => run(rows, false)}>
                {busy ? 'Importing…' : `Import ${result.total - result.errors} asset(s)`}
              </Button>
            )}
          </div>
          {!committed && result.errors ? <p className="mt-2 text-right text-xs text-muted-foreground">Rows with errors are skipped. Fix them in the file and import again.</p> : null}
        </Panel>
      ) : null}
    </div>
  )
}
