import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Monospaced, tabular figures. Use for numbers, codes, dates. */
  mono?: boolean
  /** Hide below the sm breakpoint. */
  hideOnMobile?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  caption?: string
  footer?: ReactNode
  striped?: boolean
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }

/** Ledger-style table: strong header rule, hairline row dividers, tabular numbers. */
export function DataTable<T>({ columns, rows, rowKey, caption, footer, striped = false }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b-2 border-border-strong">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={
                  `micro !text-ink px-3 sm:px-5 py-2.5 font-semibold ${alignClass[c.align ?? 'left']} ` +
                  `${c.hideOnMobile ? 'hidden sm:table-cell' : ''} ${c.className ?? ''}`
                }
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              className={`border-b border-rule last:border-b-0 ${striped && i % 2 ? 'bg-surface-sunken/60' : ''}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={
                    `px-3 sm:px-5 py-3 align-middle ${alignClass[c.align ?? 'left']} ` +
                    `${c.mono ? 'tabular' : ''} ${c.hideOnMobile ? 'hidden sm:table-cell' : ''} ${c.className ?? ''}`
                  }
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t-2 border-border-strong">
              <td colSpan={columns.length} className="px-4 sm:px-5 py-2.5">
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
