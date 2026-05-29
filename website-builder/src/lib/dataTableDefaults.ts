import { v4 as uuid } from 'uuid'
import type { DataTableColumn, DataTableRow } from '../types/builder'

export const DATA_TABLE_DEFAULTS = {
  dataTableLayout: 'classic' as const,
  dataTableTheme: 'premium' as const,
  showDataTableBorder: true,
  showDataTableHover: true,
  dataTableStickyHeader: true,
}

export function createDataTableColumn(overrides: Partial<DataTableColumn> = {}): DataTableColumn {
  return {
    id: uuid(),
    label: 'Column',
    align: 'left',
    enabled: true,
    ...overrides,
  }
}

export function createDataTableRow(cells: string[], overrides: Partial<DataTableRow> = {}): DataTableRow {
  return {
    id: uuid(),
    cells,
    enabled: true,
    ...overrides,
  }
}

export function defaultDataTableColumns(): DataTableColumn[] {
  return [
    { id: 'order', label: 'Order', align: 'left', enabled: true },
    { id: 'customer', label: 'Customer', align: 'left', enabled: true },
    { id: 'amount', label: 'Amount', align: 'right', enabled: true },
    { id: 'status', label: 'Status', align: 'center', enabled: true },
    { id: 'date', label: 'Date', align: 'left', enabled: true },
  ]
}

export function defaultDataTableRows(): DataTableRow[] {
  return [
    { id: 'r1', cells: ['#1042', 'Sarah Chen', '$248.00', 'active', 'May 12, 2026'], enabled: true },
    { id: 'r2', cells: ['#1041', 'Marcus Webb', '$89.50', 'pending', 'May 12, 2026'], enabled: true },
    { id: 'r3', cells: ['#1040', 'Priya N.', '$412.00', 'active', 'May 11, 2026'], enabled: true },
    { id: 'r4', cells: ['#1039', 'Alex Rivera', '$56.00', 'failed', 'May 11, 2026'], enabled: true },
    { id: 'r5', cells: ['#1038', 'Jamie Lee', '$129.99', 'active', 'May 10, 2026'], enabled: true },
  ]
}

export function defaultDataTableProps() {
  return {
    text: 'Recent orders',
    subtitle: 'Track transactions and fulfillment status at a glance',
    dataTableColumns: defaultDataTableColumns(),
    dataTableRows: defaultDataTableRows(),
    ...DATA_TABLE_DEFAULTS,
  }
}

export function normalizeRowCells(cells: string[], columnCount: number): string[] {
  if (cells.length === columnCount) return cells
  if (cells.length > columnCount) return cells.slice(0, columnCount)
  return [...cells, ...Array(columnCount - cells.length).fill('—')]
}

export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-900/30 dark:text-emerald-300' },
  success: { label: 'Success', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-900/30 dark:text-amber-300' },
  warning: { label: 'Warning', className: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-900/30 dark:text-amber-300' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-900/30 dark:text-rose-300' },
  error: { label: 'Error', className: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-900/30 dark:text-rose-300' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300' },
}
