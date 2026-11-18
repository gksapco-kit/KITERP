import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { extractApiError } from '@/lib/errorMessages'
import { amSend, useAm, useAmMutation, useAssetPerms, type Row } from './api'
import { DataTable, ErrorNote, Field, Loading, LocationSelect, PageHeader, Panel, Pill, Sel, Stat, StatusBadge, fmtDateTime, optList } from './ui'
import { useQueryClient } from '@tanstack/react-query'

const RESULTS = ['pending', 'found', 'missing', 'damaged', 'wrong_location']
const RESOLVE: { action: string; label: string; for: string[] }[] = [
  { action: 'mark_lost', label: 'Mark lost', for: ['missing'] },
  { action: 'update_location', label: 'Fix location', for: ['wrong_location'] },
  { action: 'send_to_maintenance', label: 'To maintenance', for: ['damaged'] },
  { action: 'found_again', label: 'Found again', for: ['missing'] },
  { action: 'accept', label: 'Accept', for: ['missing', 'damaged', 'wrong_location', 'found', 'pending'] },
]

export default function AuditDetail() {
  const { auditId = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const perms = useAssetPerms()
  const { data, isLoading, error } = useAm<Row>(`/audits/${auditId}`, undefined, { staleTime: 2_000 })
  const [filter, setFilter] = useState('')
  const [camera, setCamera] = useState(false)
  const [code, setCode] = useState('')
  const [foundLoc, setFoundLoc] = useState('')
  const [feed, setFeed] = useState<{ text: string; tone: 'green' | 'amber' | 'red' }[]>([])
  const codeRef = useRef<HTMLInputElement>(null)

  const act = useAmMutation()
  const start = useAmMutation({ success: 'Audit started' })
  const finish = useAmMutation({ success: 'Audit completed' })

  const scan = useCallback(async (value: string) => {
    const v = value.trim()
    if (!v) return
    try {
      const r = await amSend<Row>('post', `/audits/${auditId}/scan`, { code: v, found_location_id: foundLoc || undefined })
      qc.invalidateQueries({ queryKey: ['am'] })
      const tone = r.result === 'found' && !r.unexpected ? 'green' : r.result === 'found' ? 'amber' : 'red'
      const text = `${r.asset_tag} · ${r.name}: ${r.result.replace('_', ' ')}${r.unexpected ? ' (not in scope)' : ''}${r.already_scanned ? ' (already scanned)' : ''}`
      setFeed((f) => [{ text, tone: tone as 'green' | 'amber' | 'red' }, ...f].slice(0, 8))
    } catch (e) {
      const text = extractApiError(e, `Could not scan ${v}`)
      setFeed((f) => [{ text: `${v}: ${text}`, tone: 'red' as const }, ...f].slice(0, 8))
    } finally {
      setCode('')
      codeRef.current?.focus()
    }
  }, [auditId, foundLoc, qc])

  const lines: Row[] = useMemo(() => {
    const all: Row[] = data?.lines ?? []
    return filter === 'variance' ? all.filter((l) => ['missing', 'damaged', 'wrong_location'].includes(l.result) || l.unexpected)
      : filter ? all.filter((l) => l.result === filter) : all
  }, [data, filter])

  if (isLoading) return <Loading />
  if (error || !data) return <ErrorNote error={error} />

  const audit: Row = data.audit
  const counts: Row = data.counts ?? {}
  const live = audit.status === 'in_progress'
  const done = audit.status === 'completed'

  const complete = () => {
    const pending = counts.pending ?? 0
    let markMissing = false
    if (pending > 0) {
      if (!window.confirm(`${pending} asset(s) were not scanned. Mark them missing and complete the audit?`)) return
      markMissing = true
    }
    finish.mutate({ path: `/audits/${auditId}/complete`, body: { mark_pending_missing: markMissing } })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title={`${audit.audit_no} · ${audit.name}`}
        subtitle={<span className="inline-flex items-center gap-2"><StatusBadge value={audit.status} />{audit.started_at ? `Started ${fmtDateTime(audit.started_at)}` : 'Not started'}</span>}
        actions={
          <>
            <Button variant="outline" onClick={() => nav('/assets/audits')}>All audits</Button>
            {perms.audit && audit.status === 'draft' ? <Button onClick={() => start.mutate({ path: `/audits/${auditId}/start` })}>Start audit</Button> : null}
            {perms.audit && live ? <Button onClick={complete} disabled={finish.isPending}>Complete audit</Button> : null}
            {perms.audit && ['draft', 'in_progress'].includes(audit.status) ? (
              <Button variant="ghost" onClick={() => { if (window.confirm('Cancel this audit?')) act.mutate({ path: `/audits/${auditId}/cancel` }) }}>Cancel</Button>
            ) : null}
          </>
        } />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Progress" value={`${data.progress_pct}%`} hint={`${data.scanned} of ${data.total} counted`} />
        <Stat label="Found" value={counts.found ?? 0} tone="green" />
        <Stat label="Missing" value={counts.missing ?? 0} tone={counts.missing ? 'red' : undefined} />
        <Stat label="Damaged / wrong place" value={(counts.damaged ?? 0) + (counts.wrong_location ?? 0)} tone={(counts.damaged ?? 0) + (counts.wrong_location ?? 0) ? 'amber' : undefined} />
        <Stat label="Accuracy" value={`${data.accuracy_pct}%`} hint={data.unexpected ? `${data.unexpected} not in scope` : undefined} />
      </div>

      {live && perms.audit ? (
        <Panel title="Scan assets">
          <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); scan(code) }}>
              <Input ref={codeRef} autoFocus placeholder="Scan or type a tag, then Enter" value={code} onChange={(e) => setCode(e.target.value)} />
              <Button type="submit" disabled={!code.trim()}>Record</Button>
              <Button type="button" variant="outline" onClick={() => setCamera(true)} aria-label="Scan with camera"><Camera className="h-4 w-4" /></Button>
            </form>
            <Field label="I am scanning in" className="md:-mt-5"><LocationSelect value={foundLoc} onChange={setFoundLoc} blank="Expected location" /></Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">If you pick a location and the asset is meant to be elsewhere, it is recorded as “wrong location”.</p>
          {feed.length ? (
            <ul className="mt-3 space-y-1">
              {feed.map((f, i) => <li key={i} className={f.tone === 'green' ? 'text-sm text-emerald-600' : f.tone === 'amber' ? 'text-sm text-amber-600' : 'text-sm text-red-600'}>{f.text}</li>)}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Lines" actions={<div className="w-52"><Sel value={filter} onChange={setFilter} blank="All lines" options={[{ value: 'variance', label: 'Variances only' }, ...optList(RESULTS)]} /></div>}>
        <DataTable rows={lines} empty="No lines match."
          cols={[
            { key: 'asset_tag', header: 'Tag', render: (l) => <span className="font-mono font-semibold">{l.asset_tag}</span> },
            { key: 'asset_name', header: 'Asset', render: (l) => <span>{l.asset_name}{l.unexpected ? <Pill tone="amber" className="ml-2">not in scope</Pill> : null}</span> },
            { key: 'expected_location_name', header: 'Expected at' },
            { key: 'found_location_name', header: 'Found at' },
            { key: 'result', header: 'Result', render: (l) => <span className="inline-flex items-center gap-2"><StatusBadge value={l.result} />{l.resolved ? <Pill tone="green">resolved</Pill> : null}</span> },
            { key: 'act', header: '', render: (l) => perms.audit ? (
              <span className="flex flex-wrap gap-1">
                {live ? (
                  <>
                    {l.result !== 'found' ? <Button size="xs" variant="outline" onClick={() => act.mutate({ path: `/audits/${auditId}/lines/${l.id}/mark`, body: { result: 'found' } })}>Found</Button> : null}
                    {l.result !== 'missing' ? <Button size="xs" variant="ghost" onClick={() => act.mutate({ path: `/audits/${auditId}/lines/${l.id}/mark`, body: { result: 'missing' } })}>Missing</Button> : null}
                    {l.result !== 'damaged' ? <Button size="xs" variant="ghost" onClick={() => act.mutate({ path: `/audits/${auditId}/lines/${l.id}/mark`, body: { result: 'damaged', condition_observed: 'damaged' } })}>Damaged</Button> : null}
                  </>
                ) : null}
                {done && !l.resolved && (l.result !== 'found' || l.unexpected) && l.result !== 'pending'
                  ? RESOLVE.filter((r) => r.for.includes(l.result)).map((r) => (
                    <Button key={r.action} size="xs" variant={r.action === 'accept' ? 'ghost' : 'outline'} onClick={() => act.mutate({ path: `/audits/${auditId}/lines/${l.id}/resolve`, body: { action: r.action } })}>{r.label}</Button>
                  )) : null}
              </span>) : null },
          ]} />
      </Panel>

      <BarcodeScannerModal open={camera} title="Scan asset labels" onClose={() => setCamera(false)} onScan={(c) => { scan(c) }} />
    </div>
  )
}
