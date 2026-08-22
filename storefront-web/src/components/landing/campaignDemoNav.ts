/** Normalize menu labels to stable view keys. */
export function normalizeDemoNavKey(label: string): string {
  const key = label.toLowerCase().trim()
  if (key === 'blocks' || key === 'builder') return 'builder'
  return key
}

export function readDemoNavItem(el: HTMLElement): string | null {
  return el.getAttribute('data-demo-tab') || el.getAttribute('data-demo-nav')
}

export function isDemoNavElement(el: HTMLElement): boolean {
  return el.classList.contains('kiterp-campaign-demo-topnav-item')
    || el.classList.contains('kiterp-campaign-demo-nav-item')
    || el.classList.contains('kiterp-campaign-demo-mobile-tab')
}
