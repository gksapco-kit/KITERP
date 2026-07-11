export type VariantManageView = 'cards' | 'fast'

const VIEW_KEY = 'kit-variant-manage-view'

export function getVariantManageView(): VariantManageView {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    // Migrate removed "table" view to fast edit
    if (v === 'table' || v === 'fast') return 'fast'
    return 'cards'
  } catch {
    return 'cards'
  }
}

export function setVariantManageView(view: VariantManageView) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch { /* ignore */ }
}
