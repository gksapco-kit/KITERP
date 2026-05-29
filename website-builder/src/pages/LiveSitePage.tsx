import { Navigate, Route, Routes, useNavigate, useParams, Link } from 'react-router-dom'
import { useLayoutEffect, useState } from 'react'
import { ExternalLink, Layers } from 'lucide-react'
import { BlockRenderer } from '../components/blocks/BlockRenderer'
import { NavbarBlock } from '../components/blocks/NavbarBlock'
import { CategoryAllPage } from './CategoryAllPage'
import { CategoryItemPage } from './CategoryItemPage'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'
import { pageBackgroundStyle, resolvePageDarkMode } from '../lib/pageBackground'
import { hydrateLivePreviewFromStorageOrWait } from '../lib/livePreviewInject'
import {
  buildLivePreviewState,
  peekLivePreviewPayload,
  readPreviewKeyFromLocation,
} from '../lib/livePreviewTransfer'
import { loadPersistedSite } from '../lib/sitePersistence'
import { getSiteFooterBlocks, getSiteNavbarBlock, stripSiteChrome } from '../lib/siteChrome'
import { useBuilderStore } from '../store/useBuilderStore'

function LiveSiteContent() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const pages = useBuilderStore((s) => s.pages)
  const onboardingComplete = useBuilderStore((s) => s.onboardingComplete)

  const page =
    pages.find((p) => p.slug === slug) ??
    pages.find((p) => p.kind === 'home') ??
    pages[0]

  const navbarBlock = getSiteNavbarBlock(pages)
  const footerBlocks = getSiteFooterBlocks(pages)
  const bodyBlocks = stripSiteChrome(page?.blocks ?? [])

  if (!onboardingComplete || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
        <Layers className="mb-4 h-12 w-12 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-900">No published website yet</h1>
        <p className="mt-2 max-w-md text-gray-500">
          Build your site in the editor first, then open the live URL to share it.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to Website Builder
        </Link>
      </div>
    )
  }

  const pageBgStyle = pageBackgroundStyle(page)
  const pageDarkMode = resolvePageDarkMode(page, false)

  return (
    <div
      className={`flex min-h-screen flex-col ${pageDarkMode ? 'dark text-gray-100' : 'text-gray-900'}`}
      style={pageBgStyle}
    >
      {navbarBlock && (
        <header className="sticky top-0 z-20 w-full shrink-0">
          <NavbarBlock
            block={navbarBlock}
            interactive
            activeSlug={page.slug}
            onNavigate={(s) => navigate(`/site/${s}`)}
            onCartClick={() => navigate('/site/cart')}
          />
        </header>
      )}

      <main className="flex w-full max-w-full flex-1 flex-col overflow-x-clip">
        {bodyBlocks.map((block) => (
          <div key={block.id} className="w-full shrink-0">
            <BlockRenderer
              block={block}
              interactive
              darkMode={pageDarkMode}
              onNavigate={(s) => navigate(`/site/${s}`)}
            />
          </div>
        ))}
      </main>

      {footerBlocks.length > 0 && (
        <div className="mt-auto w-full shrink-0">
          {footerBlocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              interactive
              darkMode={pageDarkMode}
              onNavigate={(s) => navigate(`/site/${s}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function slugFromLivePreviewPath(): string {
  const path = window.location.pathname
  const marker = '/site/'
  const idx = path.indexOf(marker)
  if (idx === -1) return 'home'
  const rest = path.slice(idx + marker.length).split('/').filter(Boolean)[0]
  return rest ? decodeURIComponent(rest) : 'home'
}

function hydrateLiveSiteStore(): 'ready' | 'waiting-inject' {
  const previewState = hydrateLivePreviewFromStorageOrWait()
  if (previewState === 'loaded') return 'ready'
  if (previewState === 'pending-inject') return 'waiting-inject'

  const urlSlug = slugFromLivePreviewPath()
  const previewKey = readPreviewKeyFromLocation()
  if (previewKey) {
    const payload = peekLivePreviewPayload(previewKey)
    if (payload) {
      useBuilderStore.setState(buildLivePreviewState(payload, urlSlug))
      return 'ready'
    }
    return 'waiting-inject'
  }

  const saved = loadPersistedSite()
  if (!saved?.pages.length) return 'ready'

  useBuilderStore.setState(buildLivePreviewState(saved, urlSlug))
  return 'ready'
}

export function LiveSiteLayout() {
  const [hydrateState, setHydrateState] = useState<
    'loading' | 'waiting-inject' | 'ready' | 'preview-error'
  >('loading')

  useLayoutEffect(() => {
    setHydrateState(hydrateLiveSiteStore())
  }, [])

  useLayoutEffect(() => {
    if (hydrateState !== 'waiting-inject') return

    const onInjected = () => setHydrateState('ready')
    window.addEventListener('kiterp:live-preview-injected', onInjected)

    const timer = window.setTimeout(() => {
      setHydrateState((s) => (s === 'waiting-inject' ? 'preview-error' : s))
    }, 15_000)

    return () => {
      window.removeEventListener('kiterp:live-preview-injected', onInjected)
      window.clearTimeout(timer)
    }
  }, [hydrateState])

  if (hydrateState === 'loading' || hydrateState === 'waiting-inject') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading live preview…
      </div>
    )
  }

  if (hydrateState === 'preview-error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
        <p className="max-w-md text-sm text-gray-600">
          Could not load your site draft. Keep the Website Builder tab open on port 3001, then click
          View Live Site again.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed bottom-4 right-4 z-50">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-lg hover:text-brand-600"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Editor
        </Link>
      </div>
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route
          path="login"
          element={<LoginPage homePath="/site/home" signupPath="/site/signup" />}
        />
        <Route
          path="signup"
          element={<SignupPage homePath="/site/home" loginPath="/site/login" />}
        />
        <Route
          path="stack/:blockId/category/:categoryId"
          element={<CategoryAllPage />}
        />
        <Route path="stack/:blockId/item/:itemId" element={<CategoryItemPage />} />
        <Route path=":slug" element={<LiveSiteContent />} />
      </Routes>
    </div>
  )
}
