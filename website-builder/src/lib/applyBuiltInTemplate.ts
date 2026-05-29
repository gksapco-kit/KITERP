import { generateSite } from './pageTemplates'
import { persistSite, loadPersistedSite } from './sitePersistence'
import type { SiteConfig } from '../types/builder'
import { useBuilderStore } from '../store/useBuilderStore'
import { websiteTemplates } from './websiteTemplates'

/** Load a built-in website template into the builder store. */
export function applyBuiltInTemplateToStore(templateId: string): boolean {
  const builtIn = websiteTemplates.find((t) => t.id === templateId)
  if (!builtIn) return false

  const state = useBuilderStore.getState()
  const persisted = loadPersistedSite()
  const siteName = state.siteName || persisted?.siteName || 'My Website'
  const baseConfig = state.siteConfig ?? persisted?.siteConfig ?? null

  const config: SiteConfig = baseConfig
    ? {
        ...baseConfig,
        templateId,
        businessName: siteName,
        savedTemplateSourceId: undefined,
      }
    : {
        businessName: siteName,
        businessType: builtIn.businessTypes[0] ?? 'both',
        category: builtIn.category,
        templateId,
      }

  const { pages, catalog } = generateSite(config)
  useBuilderStore.setState({
    onboardingComplete: true,
    pages,
    catalog,
    siteConfig: config,
    siteName: config.businessName,
    activePageId: pages[0]?.id ?? '',
    selectedBlockId: null,
    mode: 'edit',
  })
  persistSite(useBuilderStore.getState(), { immediate: true })
  return true
}
