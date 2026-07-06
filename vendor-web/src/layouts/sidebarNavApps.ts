import type { NavOrderScope } from '@/layouts/sidebarNavOrder'

const LS_ENABLED = 'kiterp.vendor.sidebar.enabled-sections'
const LS_KNOWN_SECTIONS = 'kiterp.vendor.sidebar.known-section-ids'

/** Always visible in the sidebar — core hub for dashboard, notifications, and settings. */
export const PINNED_SIDEBAR_SECTION_IDS = ['my-kit'] as const

export const SIDEBAR_APPS_ADMIN_ONLY_MESSAGE =
  'Permission denied. Only owners and admins can install or uninstall apps. Contact your administrator.'

function scopedKey(base: string, scope: NavOrderScope | null | undefined): string {
  if (!scope?.userId) return base
  const role = scope.roleKey || 'member'
  return `${base}.${scope.userId}.${role}`
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function withPinned(ids: string[], allSectionIds: string[]): string[] {
  const set = new Set(allSectionIds)
  const out: string[] = []
  for (const pinned of PINNED_SIDEBAR_SECTION_IDS) {
    if (set.has(pinned) && !out.includes(pinned)) out.push(pinned)
  }
  for (const id of ids) {
    if (set.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

/**
 * Load enabled sidebar module ids. Defaults to all visible modules (backward compatible).
 * New modules added in an app update are auto-enabled; explicit uninstalls are preserved.
 */
export function loadEnabledSectionIds(
  allSectionIds: string[],
  scope?: NavOrderScope | null,
): string[] {
  try {
    const key = scopedKey(LS_ENABLED, scope)
    const knownKey = scopedKey(LS_KNOWN_SECTIONS, scope)
    const parsed = readJson<string[]>(key)
    const known = readJson<string[]>(knownKey) ?? []
    if (!parsed || !Array.isArray(parsed)) return [...allSectionIds]
    const valid = new Set(allSectionIds)
    const stored = parsed.filter((id) => valid.has(id))
    let enabled = withPinned(stored, allSectionIds)
    // Modules that did not exist when the user last saved — enable by default.
    for (const id of allSectionIds) {
      if (!known.includes(id) && !enabled.includes(id)) enabled.push(id)
    }
    try {
      localStorage.setItem(knownKey, JSON.stringify(allSectionIds))
    } catch {
      /* ignore */
    }
    return enabled
  } catch {
    return [...allSectionIds]
  }
}

export function saveEnabledSectionIds(ids: string[], allSectionIds: string[], scope?: NavOrderScope | null) {
  try {
    const normalized = withPinned(ids, allSectionIds)
    localStorage.setItem(scopedKey(LS_ENABLED, scope), JSON.stringify(normalized))
  } catch {
    /* ignore quota / private mode */
  }
}

export function normalizeEnabledSectionIds(ids: string[], allSectionIds: string[]): string[] {
  return withPinned(ids.filter((id) => allSectionIds.includes(id)), allSectionIds)
}

export function isPinnedSidebarSection(sectionId: string): boolean {
  return (PINNED_SIDEBAR_SECTION_IDS as readonly string[]).includes(sectionId)
}

/** Short summary shown on each app tile in the All Apps picker. */
export const SIDEBAR_APP_DESCRIPTIONS: Record<string, string> = {
  'my-kit': 'Dashboard, inbox, notifications, and store settings.',
  'website-management': 'Business Website Builder, SEO, templates, business front, and blog.',
  'sales': 'Orders, quotations, POS, bookings, projects, invoices, and marketplace.',
  'restaurant': 'Floor service, kitchen board, dine-in menu, reservations, and reports.',
  'commission': 'Payees, plans, accruals, payouts, and commission reporting.',
  'inventory': 'Products, services, stock, plants, storage locations, and purchasing.',
  'procurement': 'Purchase orders, requisitions, vendor invoices, and goods management.',
  'finance': 'Accounting, AR/AP, bank, assets, budgets, tax, and financial reports.',
  'controlling': 'Product costing, production orders, variance analysis, and period end.',
  'master-data': 'Customers, suppliers, and review management.',
  'crm': 'Contacts, pipeline, tickets, campaigns, workflows, and CRM reports.',
  'hr': 'Employees, attendance, payroll, recruitment, training, and compliance.',
  'system': 'Integrations, document templates, module settings, and access control.',
}

/** Category headers for the All Apps catalog. */
export const SIDEBAR_APP_GROUPS: { id: string; title: string; sectionIds: string[] }[] = [
  { id: 'core', title: 'My Kit', sectionIds: ['my-kit'] },
  { id: 'website', title: 'Website', sectionIds: ['website-management'] },
  { id: 'sales', title: 'Sales & Commerce', sectionIds: ['sales', 'restaurant', 'commission'] },
  {
    id: 'operations',
    title: 'Inventory & Manufacturing',
    sectionIds: ['inventory', 'procurement', 'controlling'],
  },
  { id: 'finance', title: 'Finance', sectionIds: ['finance'] },
  { id: 'data', title: 'Master Data', sectionIds: ['master-data'] },
  { id: 'crm', title: 'CRM & Customers', sectionIds: ['crm'] },
  { id: 'hr', title: 'Human Resources', sectionIds: ['hr'] },
  { id: 'system', title: 'System & Configuration', sectionIds: ['system'] },
]

export type SidebarAppSubmenuExport = {
  label: string
  path: string
  external?: boolean
  group?: string
}

export type SidebarAppExportPayload = {
  export_version: 1
  exported_at: string
  app: {
    id: string
    title: string
    description?: string
    enabled: boolean
    pinned: boolean
    submenus: SidebarAppSubmenuExport[]
  }
}

/** Download a single sidebar app module as JSON (owners/admins only in UI). */
export function downloadSidebarAppManifest(
  section: {
    id: string
    title: string
    description?: string
    submenuItems: SidebarAppSubmenuExport[]
  },
  options: { enabled: boolean; pinned?: boolean },
): void {
  const payload: SidebarAppExportPayload = {
    export_version: 1,
    exported_at: new Date().toISOString(),
    app: {
      id: section.id,
      title: section.title,
      description: section.description,
      enabled: options.enabled,
      pinned: options.pinned ?? isPinnedSidebarSection(section.id),
      submenus: section.submenuItems,
    },
  }
  const slug = section.id.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'app'
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `kiterp-app-${slug}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function groupSidebarAppSections<T extends { id: string }>(
  sections: T[],
  groups = SIDEBAR_APP_GROUPS,
): { group: { id: string; title: string } | null; sections: T[] }[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  const placed = new Set<string>()
  const result: { group: { id: string; title: string } | null; sections: T[] }[] = []

  for (const g of groups) {
    const bucket: T[] = []
    for (const id of g.sectionIds) {
      const s = byId.get(id)
      if (s) {
        bucket.push(s)
        placed.add(id)
      }
    }
    if (bucket.length) result.push({ group: { id: g.id, title: g.title }, sections: bucket })
  }

  const rest = sections.filter((s) => !placed.has(s.id))
  if (rest.length) result.push({ group: null, sections: rest })

  return result
}
