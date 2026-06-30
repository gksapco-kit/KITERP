import type { MouseEvent } from 'react'

/** Interactive targets that should not trigger the row's open/detail handler. */
const ROW_CONTROL_SELECTOR =
  'button, a, input, select, textarea, label, [role=combobox], [role=switch], [role=option], [data-stop-row-click]'

export function isTableRowControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest(ROW_CONTROL_SELECTOR))
}

/** Row click handler: opens detail view unless the user clicked a control inside the row. */
export function onClickableTableRow(handler: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (isTableRowControlTarget(event.target)) return
    handler()
  }
}
