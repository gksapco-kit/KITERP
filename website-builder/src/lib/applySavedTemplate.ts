import { ensureLegalPages, migrateSitePages } from './legalPageDefaults'
import { persistSite } from './sitePersistence'
import type { SavedTemplate } from './savedTemplatePersistence'
import { useBuilderStore } from '../store/useBuilderStore'

/** Load a saved template into the builder store and persist it as the active site. */
export function applySavedTemplateToStore(tpl: SavedTemplate): void {
  const loadedConfig = {
    ...JSON.parse(JSON.stringify(tpl.siteConfig)),
    savedTemplateSourceId: tpl.id,
  }

  const rawPages = JSON.parse(JSON.stringify(tpl.pages)) as typeof tpl.pages
  const businessName = loadedConfig.businessName ?? tpl.siteName
  const pages = migrateSitePages(
    ensureLegalPages(rawPages, { businessName, siteConfig: loadedConfig }),
    businessName,
  )

  useBuilderStore.setState({
    onboardingComplete: true,
    pages,
    catalog: JSON.parse(JSON.stringify(tpl.catalog)),
    siteConfig: loadedConfig,
    siteName: tpl.siteName,
    activePageId: pages[0]?.id ?? '',
    selectedBlockId: null,
    mode: 'edit',
  })
  persistSite(useBuilderStore.getState(), { immediate: true })
}
