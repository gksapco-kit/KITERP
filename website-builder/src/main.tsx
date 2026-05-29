import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { listenForEmbedConfigFromParent } from './lib/embedConfig'
import { listenForLivePreviewInject } from './lib/livePreviewInject'
import { listenForLivePreviewTriggerFromParent } from './lib/openLivePreviewAction'
import { initLargeStorage } from './lib/largeStorage'
import { useAuthStore } from './store/useAuthStore'

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useAuthStore.getState().hydrate()
  }, [])
  return children
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('storage-init-timeout')), ms)
    }),
  ])
}

async function bootstrap() {
  listenForEmbedConfigFromParent()
  listenForLivePreviewTriggerFromParent()
  listenForLivePreviewInject()
  try {
    await withTimeout(initLargeStorage(), 8000)
  } catch (err) {
    console.warn('[website-builder] storage init skipped:', err)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </StrictMode>,
  )
}

void bootstrap()
