import type { PlatformModuleDef, PlatformSubmodule } from '@/api/admin.api'

/** Effective level a role has on one sub-module. */
export type SubmoduleLevel = 'none' | 'view' | 'manage'

export function submoduleLevel(perms: string[], sub: PlatformSubmodule): SubmoduleLevel {
  if (sub.manage_key && perms.includes(sub.manage_key)) return 'manage'
  if (sub.view_key && perms.includes(sub.view_key)) return 'view'
  return 'none'
}

/** Levels a sub-module can be set to (access-mode screens cannot be view-only). */
export function allowedLevels(sub: PlatformSubmodule): SubmoduleLevel[] {
  if (sub.mode === 'access') return ['none', 'manage']
  if (sub.mode === 'view_only') return ['none', 'view']
  return ['none', 'view', 'manage']
}

/** Returns a new permission list with one sub-module set to `level`. */
export function setSubmoduleLevel(
  perms: string[],
  sub: PlatformSubmodule,
  level: SubmoduleLevel,
): string[] {
  const own = [sub.view_key, sub.manage_key].filter((k): k is string => !!k)
  const next = perms.filter((p) => !own.includes(p))
  if (level === 'none') return next
  if (level === 'view') {
    if (sub.view_key) next.push(sub.view_key)
    else if (sub.manage_key) next.push(sub.manage_key)
    return next
  }
  if (sub.view_key) next.push(sub.view_key)
  if (sub.manage_key) next.push(sub.manage_key)
  return next
}

/**
 * Bulk-set a whole module. "view" skips access-mode sub-modules (they cannot be read-only);
 * "manage" gives every sub-module its highest level.
 */
export function setModuleLevel(
  perms: string[],
  module: PlatformModuleDef,
  level: SubmoduleLevel,
): string[] {
  let next = perms
  for (const sub of module.submodules) {
    if (level === 'view' && sub.mode === 'access') continue
    next = setSubmoduleLevel(next, sub, level)
  }
  return next
}

export type ModuleSummaryRow = { slug: string; label: string; level: 'view' | 'manage'; mode: PlatformSubmodule['mode'] }

/** Sub-modules a role can open, per module, for read-only display. */
export function summarizeModules(
  perms: string[],
  modules: PlatformModuleDef[],
): { module: string; label: string; total: number; rows: ModuleSummaryRow[] }[] {
  return modules.map((m) => {
    const rows: ModuleSummaryRow[] = []
    for (const sub of m.submodules) {
      const level = submoduleLevel(perms, sub)
      if (level !== 'none') rows.push({ slug: sub.slug, label: sub.label, level, mode: sub.mode })
    }
    return { module: m.module, label: m.label, total: m.submodules.length, rows }
  })
}
