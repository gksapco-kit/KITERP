const MODEL_VIEWER_SRC =
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'

let loadPromise: Promise<void> | null = null

/** Load Google's model-viewer once (not in index.html — avoids blocking / failures on the whole app). */
export function ensureModelViewerScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (customElements.get('model-viewer')) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = MODEL_VIEWER_SRC
    s.async = true
    s.dataset.modelViewerLoader = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('model-viewer load failed'))
    document.head.appendChild(s)
  })
  return loadPromise
}
