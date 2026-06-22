import type { LucideIcon } from 'lucide-react'
import { AlertCircle, CheckCircle2, EyeOff, Store } from 'lucide-react'
import type { BuilderSiteLiveBlockReason } from '@/lib/builderDraftTemplateSites'
import type { SiteListItem } from '@/types/websites'

export type SiteCardDisplayStatusId =
  | 'draft'
  | 'ready_for_assign'
  | 'needs_activation'
  | 'live'
  | 'archived'

export type SiteCardStatusDisplay = {
  id: SiteCardDisplayStatusId
  label: string
  shortLabel: string
  icon: LucideIcon
  color: string
}

export const SITE_CARD_STATUS_DISPLAY: Record<SiteCardDisplayStatusId, Omit<SiteCardStatusDisplay, 'id'>> = {
  draft: {
    label: 'Draft — not published yet',
    shortLabel: 'Draft',
    icon: AlertCircle,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  ready_for_assign: {
    label: 'Ready to assign — enable in Templates and pick a business unit',
    shortLabel: 'Ready for assign',
    icon: Store,
    color: 'text-violet-700 bg-violet-50 border-violet-200',
  },
  needs_activation: {
    label: 'Assigned — activate in Templates to replace the catalog template on the live storefront',
    shortLabel: 'Needs activation',
    icon: AlertCircle,
    color: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  live: {
    label: 'Live for customers on the storefront',
    shortLabel: 'Live',
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  archived: {
    label: 'Archived',
    shortLabel: 'Archived',
    icon: EyeOff,
    color: 'text-gray-500 bg-gray-50 border-gray-200',
  },
}

/** Storefront-facing badge — "Live" only when customers can actually visit the site. */
export function resolveSiteCardDisplayStatus(input: {
  site: Pick<SiteListItem, 'status' | 'is_published'>
  viewLiveLinksCount: number
  liveBlockReason?: BuilderSiteLiveBlockReason | null
  isAssignedToStore?: boolean
}): SiteCardStatusDisplay {
  let id: SiteCardDisplayStatusId
  if (input.site.status === 'archived') {
    id = 'archived'
  } else if (!input.site.is_published) {
    id = 'draft'
  } else if (input.viewLiveLinksCount > 0) {
    id = 'live'
  } else if (
    input.isAssignedToStore
    && input.liveBlockReason === 'catalog_template_override'
  ) {
    id = 'needs_activation'
  } else {
    id = 'ready_for_assign'
  }
  return { id, ...SITE_CARD_STATUS_DISPLAY[id] }
}
