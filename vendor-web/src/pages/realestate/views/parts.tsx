import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { fieldClass, fmtMoney } from '../shared'

export function Kpi({ label, value, tone }: { label: string; value: ReactNode; tone?: 'bad' | 'good' | 'warn' }) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : ''
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}

export type Col<T> = { key: string; label: string; right?: boolean; render?: (row: T) => ReactNode }

export function SimpleTable<T extends Record<string, any>>({
  cols, rows, empty = 'Nothing to show',
}: { cols: Col<T>[]; rows: T[]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-medium ${c.right ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-muted-foreground">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.right ? 'text-right tabular-nums' : ''}`}>
                  {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const money = (v: unknown) => fmtMoney(Number(v ?? 0))

/** Project dropdown ("All projects" when value is empty). */
export function ProjectFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const projects = useQuery({ queryKey: ['re-ref', 'projects'], queryFn: () => reApi.list('projects', { size: 200 }) })
  return (
    <select className={`${fieldClass} w-64`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All projects</option>
      {(projects.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p._label}</option>)}
    </select>
  )
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
}
