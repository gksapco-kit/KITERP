import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createDataTableColumn,
  createDataTableRow,
  defaultDataTableColumns,
  defaultDataTableRows,
  normalizeRowCells,
} from '../../lib/dataTableDefaults'
import type { Block, BlockStyles, DataTableColumn, DataTableRow } from '../../types/builder'
import { ThemeGradientFields } from './ThemeGradientFields'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface DataTablePropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<BlockStyles>) => void
}

export function DataTablePropertiesFields({ block, onChange, onStylesChange }: DataTablePropertiesFieldsProps) {
  const p = block.props
  const columns = p.dataTableColumns ?? defaultDataTableColumns()
  const rows = p.dataTableRows ?? defaultDataTableRows()
  const [expandedCol, setExpandedCol] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const syncRowsToColumns = (nextColumns: DataTableColumn[], currentRows = rows) => {
    const count = nextColumns.filter((c) => c.enabled !== false).length
    return currentRows.map((row) => ({
      ...row,
      cells: normalizeRowCells(row.cells, count),
    }))
  }

  const updateColumns = (next: DataTableColumn[]) => {
    onChange({ dataTableColumns: next, dataTableRows: syncRowsToColumns(next) })
  }

  const updateRows = (next: DataTableRow[]) => onChange({ dataTableRows: next })

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Data Table</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Recent orders" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={p.dataTableLayout ?? 'classic'}
          onChange={(e) => onChange({ dataTableLayout: e.target.value as 'classic' | 'striped' | 'compact' })}
        >
          <option value="classic">Classic</option>
          <option value="striped">Striped rows</option>
          <option value="compact">Compact</option>
        </select>
      </Field>

      <Field label="Theme">
        <select
          className={inputClass}
          value={p.dataTableTheme ?? 'premium'}
          onChange={(e) => onChange({ dataTableTheme: e.target.value as 'light' | 'dark' | 'premium' })}
        >
          <option value="premium">Premium</option>
          <option value="light">Light</option>
          <option value="dark">Dark gradient</option>
        </select>
      </Field>

      <ThemeGradientFields block={block} theme={p.dataTableTheme} onStylesChange={onStylesChange} showForThemes={['premium', 'dark']} />

      <ToggleField label="Row hover highlight" checked={p.showDataTableHover !== false} onChange={(v) => onChange({ showDataTableHover: v })} />
      <ToggleField label="Row dividers" checked={p.showDataTableBorder !== false} onChange={(v) => onChange({ showDataTableBorder: v })} />
      <ToggleField label="Sticky header" checked={p.dataTableStickyHeader !== false} onChange={(v) => onChange({ dataTableStickyHeader: v })} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Columns ({columns.length})</p>
        <button
          type="button"
          onClick={() => updateColumns([...columns, createDataTableColumn({ label: `Column ${columns.length + 1}` })])}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="space-y-2">
        {columns.map((col, i) => {
          const key = col.id ?? String(i)
          const open = expandedCol === key
          return (
            <div key={key} className="rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setExpandedCol(open ? null : key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <span className="truncate text-sm font-medium">{col.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateColumns(columns.filter((_, idx) => idx !== i))}
                  className="rounded p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                  <Field label="Header label">
                    <input
                      className={inputClass}
                      value={col.label}
                      onChange={(e) => {
                        const next = [...columns]
                        next[i] = { ...col, label: e.target.value }
                        updateColumns(next)
                      }}
                    />
                  </Field>
                  <Field label="Alignment">
                    <select
                      className={inputClass}
                      value={col.align ?? 'left'}
                      onChange={(e) => {
                        const next = [...columns]
                        next[i] = { ...col, align: e.target.value as DataTableColumn['align'] }
                        updateColumns(next)
                      }}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rows ({rows.length})</p>
        <button
          type="button"
          onClick={() => updateRows([...rows, createDataTableRow(Array(columns.length).fill('—'))])}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <Field label="Cell values" hint="Status badges: active, pending, failed, draft, success, warning">
        <span className="text-[11px] text-gray-400">One value per column, left to right</span>
      </Field>

      <div className="space-y-2">
        {rows.map((row, i) => {
          const key = row.id ?? String(i)
          const open = expandedRow === key
          const cells = normalizeRowCells(row.cells, columns.length)
          return (
            <div key={key} className="rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setExpandedRow(open ? null : key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <span className="truncate text-sm font-medium">{cells[0] || `Row ${i + 1}`}</span>
                </button>
                <button type="button" onClick={() => updateRows(rows.filter((_, idx) => idx !== i))} className="rounded p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                  {columns.map((col, ci) => (
                    <Field key={col.id ?? ci} label={col.label}>
                      <input
                        className={inputClass}
                        value={cells[ci] ?? ''}
                        onChange={(e) => {
                          const nextCells = [...cells]
                          nextCells[ci] = e.target.value
                          const next = [...rows]
                          next[i] = { ...row, cells: nextCells }
                          updateRows(next)
                        }}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
