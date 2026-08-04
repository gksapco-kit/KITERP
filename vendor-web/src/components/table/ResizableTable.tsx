/**
 * ResizableTable
 *
 * Drop-in wrapper around a plain <table>. Pass:
 *   - tableId       — unique key for localStorage persistence
 *   - defaultWidths — pixel widths for each column (length must match th count)
 *   - children      — <thead>, <tbody>, etc. exactly as you would write them
 *
 * The component injects:
 *   - a <colgroup> with controlled <col> widths
 *   - a drag handle on the right edge of every <th>
 *
 * Usage:
 *   <ResizableTable tableId="products" defaultWidths={[300, 120, 90, 100, 80, 80, 100]}>
 *     <thead>…</thead>
 *     <tbody>…</tbody>
 *   </ResizableTable>
 */

import React, { Children, isValidElement, cloneElement } from 'react'
import { useColumnResize } from '@/hooks/useColumnResize'

interface Props {
  tableId: string
  defaultWidths: number[]
  children: React.ReactNode
  className?: string
}

export function ResizableTable({ tableId, defaultWidths, children, className }: Props) {
  const { widths, startResize } = useColumnResize(tableId, defaultWidths)

  // Inject drag handles into every <th> inside <thead>
  const patchedChildren = Children.map(children, child => {
    if (!isValidElement(child)) return child
    // Only patch <thead>
    if ((child as React.ReactElement).type !== 'thead') return child

    const thead = child as React.ReactElement<{ children: React.ReactNode }>
    const patchedRows = Children.map(thead.props.children, row => {
      if (!isValidElement(row)) return row
      const tr = row as React.ReactElement<{ children: React.ReactNode }>
      let colIdx = 0
      const patchedCells = Children.map(tr.props.children, cell => {
        if (!isValidElement(cell) || (cell as React.ReactElement).type !== 'th') return cell
        const th = cell as React.ReactElement<React.ThHTMLAttributes<HTMLTableCellElement>>
        const ci = colIdx++
        // Narrow columns (e.g. checkbox) must not clip controls; label columns keep nowrap.
        const colWidth = widths[ci] ?? 40
        const isNarrow = colWidth <= 56
        return cloneElement(th, {
          style: {
            ...(th.props.style || {}),
            position: 'relative',
            width: widths[ci] ?? 'auto',
            minWidth: colWidth,
            overflow: isNarrow ? 'visible' : 'hidden',
            whiteSpace: isNarrow ? undefined : 'nowrap',
          },
          children: (
            <>
              {th.props.children}
              <div
                onMouseDown={e => {
                  e.preventDefault()
                  startResize(ci, e.clientX)
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  height: '100%',
                  width: 6,
                  cursor: 'col-resize',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="group/resize"
              >
                <div
                  style={{ width: 2, height: '60%', borderRadius: 1, transition: 'opacity 0.15s' }}
                  className="bg-gray-300 opacity-0 group-hover/resize:opacity-100 hover:!opacity-100"
                />
              </div>
            </>
          ),
        })
      })
      return cloneElement(tr, {}, ...( patchedCells ?? []))
    })
    return cloneElement(thead, {}, ...(patchedRows ?? []))
  })

  return (
    <div className="overflow-x-auto">
      <table
        className={className}
        style={{
          tableLayout: 'fixed',
          width: '100%',
          minWidth: widths.reduce((sum, w) => sum + w, 0),
        }}
      >
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w, minWidth: w }} />
          ))}
        </colgroup>
        {patchedChildren}
      </table>
    </div>
  )
}
