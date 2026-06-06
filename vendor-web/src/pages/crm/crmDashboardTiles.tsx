import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

export type CrmTrendRange = '30d' | '3m' | '6m' | '1y' | '2y' | '5y' | '10y'

export const CRM_TREND_RANGES: { id: CrmTrendRange; label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '3m', label: '3 mon' },
  { id: '6m', label: '6 mon' },
  { id: '1y', label: '1 year' },
  { id: '2y', label: '2 years' },
  { id: '5y', label: '5 years' },
  { id: '10y', label: '10 years' },
]

export function sparklinePath(values: number[], w = 88, h = 28): string {
  if (!values.length) return ''
  if (values.length === 1) values = [values[0], values[0]]
  const pad = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M${pts.join(' L')}`
}

const ACCENT: Record<string, { chip: string; stroke: string }> = {
  blue:   { chip: 'bg-blue-50 text-blue-600', stroke: '#2563eb' },
  green:  { chip: 'bg-emerald-50 text-emerald-600', stroke: '#059669' },
  amber:  { chip: 'bg-amber-50 text-amber-600', stroke: '#d97706' },
  rose:   { chip: 'bg-rose-50 text-rose-600', stroke: '#e11d48' },
  violet: { chip: 'bg-violet-50 text-violet-600', stroke: '#7c3aed' },
}

export function CrmStatTile({
  label, value, hint, icon: Icon, accent = 'blue', to, spark,
}: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  accent?: keyof typeof ACCENT
  to?: string
  spark?: number[]
}) {
  const tone = ACCENT[accent] ?? ACCENT.blue
  const path = spark?.length ? sparklinePath(spark) : ''

  const inner = (
    <Card className="h-[104px] hover:shadow-md transition-shadow">
      <CardContent className="p-3 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 min-h-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 truncate leading-tight">{label}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5 truncate leading-tight">{value}</p>
            {hint && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{hint}</p>}
          </div>
          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${tone.chip}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="h-7 flex items-end justify-end">
          {path ? (
            <svg viewBox="0 0 88 28" className="h-7 w-[5.5rem]" fill="none" aria-hidden>
              <path d={path} stroke={tone.stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="text-[10px] text-gray-300">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
  return to ? <Link to={to} className="block h-[104px]">{inner}</Link> : <div className="h-[104px]">{inner}</div>
}

export function CrmRangePicker({
  value, onChange,
}: {
  value: CrmTrendRange
  onChange: (v: CrmTrendRange) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CRM_TREND_RANGES.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
            value === r.id
              ? 'bg-primary text-white border-blue-600'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
