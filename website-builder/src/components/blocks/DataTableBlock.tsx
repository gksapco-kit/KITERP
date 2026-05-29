import { SectionHeading } from '../builder/SectionHeading'
import { DATA_TABLE_DEFAULTS, normalizeRowCells, STATUS_BADGE } from '../../lib/dataTableDefaults'
import { blockThemeGradientStyle, softThemeGradientShellStyle } from '../../lib/themeGradientUtils'
import type { Block, DataTableColumn } from '../../types/builder'

interface DataTableBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

type Layout = 'classic' | 'striped' | 'compact'
type Theme = 'light' | 'dark' | 'premium'

function alignClass(align?: DataTableColumn['align']) {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function CellContent({ value, theme, compact }: { value: string; theme: Theme; compact?: boolean }) {
  const raw = value.trim()
  const key = raw.toLowerCase()
  const badge = STATUS_BADGE[key]

  if (badge) {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${badge.className}`}>
        {badge.label}
      </span>
    )
  }

  if (/^https?:\/\//i.test(raw)) {
    return (
      <a
        href={raw}
        className={`font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400 ${compact ? 'text-xs' : 'text-sm'}`}
        onClick={(e) => e.preventDefault()}
      >
        {raw.replace(/^https?:\/\//, '').slice(0, 32)}
      </a>
    )
  }

  const isAmount = /^\$[\d,]+(\.\d{2})?$/.test(raw)
  return (
    <span
      className={`${compact ? 'text-xs' : 'text-sm'} ${
        isAmount ? 'font-semibold tabular-nums' : ''
      } ${theme === 'dark' ? 'text-white/90' : 'text-gray-700 dark:text-gray-200'}`}
    >
      {raw}
    </span>
  )
}

export function DataTableBlock({ block, layoutStyle }: DataTableBlockProps) {
  const { props, styles } = block
  const layout = (props.dataTableLayout ?? DATA_TABLE_DEFAULTS.dataTableLayout) as Layout
  const theme = (props.dataTableTheme ?? DATA_TABLE_DEFAULTS.dataTableTheme) as Theme
  const showBorder = props.showDataTableBorder !== false
  const showHover = props.showDataTableHover !== false
  const stickyHeader = props.dataTableStickyHeader !== false
  const compact = layout === 'compact'

  const columns = (props.dataTableColumns ?? []).filter((c) => c.enabled !== false)
  const rows = (props.dataTableRows ?? []).filter((r) => r.enabled !== false)

  if (columns.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-8 text-center text-sm text-gray-400">
        Add columns in the properties panel
      </section>
    )
  }

  const isDark = theme === 'dark'
  const shellClass = isDark
    ? 'border border-white/10 bg-gray-950'
    : theme === 'premium'
      ? 'border border-gray-200/80 bg-white shadow-[0_16px_48px_-24px_rgba(15,23,42,0.18)] ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/50 dark:ring-gray-800'
      : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40'

  const headClass = isDark
    ? 'bg-gray-900/95 text-white/70'
    : 'bg-gray-50/95 text-gray-500 dark:bg-gray-800/90 dark:text-gray-400'

  const rowPad = compact ? 'px-3 py-2.5' : 'px-4 py-3.5 sm:px-5 sm:py-4'
  const divideClass = showBorder ? (isDark ? 'divide-white/10' : 'divide-gray-100 dark:divide-gray-800') : 'divide-transparent'

  const table = (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[560px] border-collapse ${compact ? 'text-sm' : ''}`}>
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200 dark:border-gray-700'} ${headClass}`}>
            {columns.map((col) => (
              <th
                key={col.id ?? col.label}
                className={`${rowPad} text-xs font-semibold uppercase tracking-[0.12em] ${alignClass(col.align)}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${divideClass}`}>
          {rows.map((row, rowIndex) => {
            const cells = normalizeRowCells(row.cells, columns.length)
            const zebra = layout === 'striped' && rowIndex % 2 === 1
            return (
              <tr
                key={row.id ?? rowIndex}
                className={`transition-colors ${
                  showHover ? (isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-brand-50/40 dark:hover:bg-brand-950/20') : ''
                } ${zebra ? (isDark ? 'bg-white/[0.02]' : 'bg-gray-50/70 dark:bg-gray-800/30') : ''}`}
              >
                {cells.map((cell, cellIndex) => (
                  <td key={`${row.id ?? rowIndex}-${cellIndex}`} className={`${rowPad} ${alignClass(columns[cellIndex]?.align)}`}>
                    <CellContent value={cell} theme={theme} compact={compact} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const wrapped = (
    <div className={`overflow-hidden rounded-2xl ${shellClass}`} style={{ borderRadius: styles.borderRadius ?? undefined }}>
      {table}
    </div>
  )

  if (isDark) {
    return (
      <section style={layoutStyle} className="w-full">
        <div className="overflow-hidden rounded-2xl px-4 py-10 sm:px-8 sm:py-12" style={blockThemeGradientStyle(styles)}>
          <div className="mx-auto max-w-6xl">
            {(props.text || props.subtitle) && (
              <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6 text-white [&_p]:text-white/65" />
            )}
            {wrapped}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-6xl">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
        )}
        {theme === 'premium' ? (
          <div className="rounded-[1.25rem] p-1" style={softThemeGradientShellStyle(styles)}>{wrapped}</div>
        ) : (
          wrapped
        )}
      </div>
    </section>
  )
}
