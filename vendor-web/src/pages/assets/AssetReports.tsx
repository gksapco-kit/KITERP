import { useState } from 'react'
import { useAm, useAssetPerms, type Row } from './api'
import { DataTable, ErrorNote, Loading, PageHeader, Stat, Tabs, money } from './ui'

type Tab = 'location' | 'maintenance' | 'aging' | 'finance'

function Report({ path, cols, empty }: { path: string; cols: { key: string; header: string; right?: boolean; fmt?: (v: any) => string }[]; empty: string }) {
  const { data, isLoading, error } = useAm<Row[]>(path)
  if (isLoading) return <Loading />
  if (error) return <ErrorNote error={error} />
  return (
    <DataTable rows={data ?? []} empty={empty}
      cols={cols.map((c) => ({ key: c.key, header: c.header, className: c.right ? 'text-right' : undefined, render: (r: Row) => (c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? '—')) }))} />
  )
}

function FinanceSummary() {
  const { data, isLoading, error } = useAm<Row>('/finance/summary')
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorNote error={error} />
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Active assets" value={data.active_assets ?? 0} />
      <Stat label="Capitalised" value={data.capitalized ?? 0} tone="green" />
      <Stat label="Not in Finance" value={data.not_capitalized ?? 0} tone={data.not_capitalized ? 'amber' : undefined} hint="Candidates for capitalising" />
      <Stat label="Finance assets not here" value={data.finance_assets_not_in_module ?? 0} hint="Use “Import from Finance”" />
      <Stat label="Purchase cost" value={money(data.total_cost)} />
      <Stat label="Accumulated depreciation" value={money(data.accumulated_depreciation)} />
      <Stat label="Net book value" value={money(data.net_book_value)} />
    </div>
  )
}

export default function AssetReports() {
  const perms = useAssetPerms()
  const [tab, setTab] = useState<Tab>('location')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'location', label: 'By location' }, { id: 'maintenance', label: 'Maintenance cost' }, { id: 'aging', label: 'Aging' },
    ...(perms.finance ? [{ id: 'finance' as Tab, label: 'Finance' }] : []),
  ]
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Asset Reports" subtitle="Where your assets are, what they cost to keep running, and how old they are." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'location' ? <Report path="/reports/by-location" empty="No assets yet." cols={[{ key: 'name', header: 'Location' }, { key: 'count', header: 'Assets', right: true }, { key: 'value', header: 'Value', right: true, fmt: money }]} /> : null}
      {tab === 'maintenance' ? <Report path="/reports/maintenance-cost" empty="No completed work orders." cols={[{ key: 'asset_tag', header: 'Tag' }, { key: 'name', header: 'Asset' }, { key: 'work_orders', header: 'Work orders', right: true }, { key: 'downtime_hours', header: 'Downtime (h)', right: true }, { key: 'cost', header: 'Cost', right: true, fmt: money }]} /> : null}
      {tab === 'aging' ? <Report path="/reports/aging" empty="No assets yet." cols={[{ key: 'bucket', header: 'Age' }, { key: 'count', header: 'Assets', right: true }, { key: 'value', header: 'Purchase cost', right: true, fmt: money }]} /> : null}
      {tab === 'finance' && perms.finance ? <FinanceSummary /> : null}
    </div>
  )
}
