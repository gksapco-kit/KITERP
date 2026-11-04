import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { reApi } from '@/api/realestate'
import { Badge } from '@/components/ui/badge'
import { Kpi, Loading, ProjectFilter, SimpleTable, money } from './parts'

type Row = {
  store: string
  material: string
  code: string | null
  unit: string
  quantity: number
  avg_rate: number
  value: number
  reorder_level: number
  low_stock: boolean
}

type Report = { rows: Row[]; total_value: number; low_stock_count: number }

export default function StockBalance() {
  const [project, setProject] = useState('')
  const q = useQuery({
    queryKey: ['re-stock-balance', project],
    queryFn: () => reApi.report<Report>('/inventory/stock-balance', project ? { project_id: project } : {}),
  })
  const d = q.data
  return (
    <div className="space-y-4">
      <ProjectFilter value={project} onChange={setProject} />
      {q.isLoading || !d ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Stock value" value={money(d.total_value)} />
            <Kpi label="Items in stock" value={d.rows.length} />
            <Kpi label="At / below reorder level" value={d.low_stock_count} tone={d.low_stock_count ? 'warn' : 'good'} />
          </div>
          <SimpleTable
            rows={d.rows}
            empty="No stock on hand — post a GRN to receive material"
            cols={[
              { key: 'store', label: 'Store' },
              { key: 'material', label: 'Material', render: (r) => `${r.material}${r.code ? ` (${r.code})` : ''}` },
              { key: 'quantity', label: 'Quantity', right: true, render: (r) => `${r.quantity.toLocaleString('en-IN')} ${r.unit}` },
              { key: 'avg_rate', label: 'Avg. rate', right: true, render: (r) => money(r.avg_rate) },
              { key: 'value', label: 'Value', right: true, render: (r) => money(r.value) },
              { key: 'reorder_level', label: 'Reorder at', right: true },
              { key: 'low', label: '', render: (r) => (r.low_stock ? <Badge variant="warning">Low stock</Badge> : null) },
            ]}
          />
        </>
      )}
    </div>
  )
}
