import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'
import { Editor } from '../components/editor/Editor'
import { applySavedTemplateToStore } from '../lib/applySavedTemplate'
import { applyBuiltInTemplateToStore } from '../lib/applyBuiltInTemplate'
import { ensureLegalPages, migrateSitePages } from '../lib/legalPageDefaults'
import { recoverTemplatesFromBackupIfNeeded, getSavedTemplate } from '../lib/savedTemplatePersistence'
import { loadPersistedSite } from '../lib/sitePersistence'
import { useBuilderStore } from '../store/useBuilderStore'
import { useEffect } from 'react'

function clearBuilderQueryParam(name: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(name)) return
  url.searchParams.delete(name)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function BuilderPage() {
  const onboardingComplete = useBuilderStore((s) => s.onboardingComplete)

  useEffect(() => {
    recoverTemplatesFromBackupIfNeeded()

    const params = new URLSearchParams(window.location.search)

    if (params.get('newTemplate') === '1') {
      useBuilderStore.getState().startNewBlankSite()
      clearBuilderQueryParam('newTemplate')
      return
    }

    const applyTemplateId = params.get('applyTemplate')?.trim()
    if (applyTemplateId) {
      const tpl = getSavedTemplate(applyTemplateId)
      if (tpl) {
        applySavedTemplateToStore(tpl)
        clearBuilderQueryParam('applyTemplate')
        return
      }
    }

    const builtInTemplateId = params.get('builtInTemplate')?.trim()
    if (builtInTemplateId && applyBuiltInTemplateToStore(builtInTemplateId)) {
      clearBuilderQueryParam('builtInTemplate')
      return
    }

    const state = useBuilderStore.getState()
    const saved = loadPersistedSite()

    if (saved && saved.pages.length > 0 && !state.onboardingComplete) {
      useBuilderStore.setState({
        onboardingComplete: true,
        siteName: saved.siteName,
        siteConfig: saved.siteConfig,
        pages: saved.pages,
        catalog: saved.catalog,
        activePageId: saved.pages[0]?.id ?? '',
        cart: [],
        selectedBlockId: null,
        mode: 'edit',
      })
      return
    }

    if (state.onboardingComplete && state.pages.length > 0 && state.siteConfig) {
      const businessName = state.siteConfig.businessName ?? state.siteName
      const pages = migrateSitePages(
        ensureLegalPages(state.pages, { businessName, siteConfig: state.siteConfig }),
        businessName,
      )
      useBuilderStore.setState({ pages })
    }
  }, [])

  return (
    <div className="h-full">
      {onboardingComplete ? <Editor /> : <OnboardingWizard />}
    </div>
  )
}
