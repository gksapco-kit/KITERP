/** Window event: reset sidebar section/item order to defaults for the current user + role scope. */
export const RESET_USER_NAV_ORDER_EVENT = 'kiterp:reset-user-nav-order'

export function dispatchResetUserNavOrder(): void {
  window.dispatchEvent(new CustomEvent(RESET_USER_NAV_ORDER_EVENT))
}
