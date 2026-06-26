import { useRef, useState, useCallback, useEffect } from 'react'
import { FileText } from 'lucide-react'

export function OfferLetterPreviewFrame({
  html,
  title = 'Offer preview',
}: {
  html: string
  title?: string
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [frameHeight, setFrameHeight] = useState(320)

  const resizeFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    const page = doc.querySelector('.page') as HTMLElement | null
    const h = page
      ? page.offsetTop + page.offsetHeight
      : (doc.documentElement.scrollHeight || doc.body.scrollHeight)
    setFrameHeight(Math.max(100, h))
  }, [])

  useEffect(() => {
    if (!html) return
    const t = window.setTimeout(resizeFrame, 60)
    return () => window.clearTimeout(t)
  }, [html, resizeFrame])

  if (!html) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 px-6 text-center">
        <FileText className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Your letter preview will appear here</p>
        <p className="text-xs text-gray-400 mt-1">Start typing in the editor</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-[#525659] p-4 shadow-inner">
      <div className="mx-auto max-w-full bg-white shadow-lg overflow-hidden">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title={title}
          onLoad={resizeFrame}
          scrolling="no"
          className="w-full border-0 block bg-white"
          style={{ height: `${frameHeight}px`, display: 'block' }}
        />
      </div>
    </div>
  )
}
