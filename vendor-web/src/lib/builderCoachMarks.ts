/** localStorage keys for builder onboarding / coach marks (P0–P2). */
export const BUILDER_WELCOME_KEY = 'asureit.builder.welcome.v2'
export const BUILDER_DRAFT_GUIDE_KEY = 'asureit.builder.draft-guide.v2'
export const BUILDER_SPACING_TIP_KEY = 'asureit.builder.spacing-tip.v2'

const LEGACY_KEYS = [
  'asureit.builder.welcome.v1',
  'asureit.builder.draft-guide.v1',
  'asureit.builder.spacing-tip.v1',
]

export function readCoachMarkDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function dismissCoachMark(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

export function restoreCoachMark(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function resetAllBuilderCoachMarks(): void {
  try {
    for (const key of [BUILDER_WELCOME_KEY, BUILDER_DRAFT_GUIDE_KEY, BUILDER_SPACING_TIP_KEY, ...LEGACY_KEYS]) {
      localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}
