import { useEffect, useMemo, useRef, useState } from 'react'
import { Code2 } from 'lucide-react'
import type { PublicSite, StyleConfig } from '@/blocks/registry'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { cn } from '@/lib/utils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  blockId?: string
}

let embedSeq = 0

function buildSrcDoc(html: string, embedId: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<base target="_parent">',
    '<style>html,body{margin:0;padding:0;}</style>',
    '</head><body>',
    html,
    '<script>(function(){',
    'function post(){try{',
    'var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);',
    `parent.postMessage({__htmlEmbedId:'${embedId}',height:h},'*');`,
    '}catch(e){}}',
    'window.addEventListener("load",post);',
    'if(window.ResizeObserver){new ResizeObserver(post).observe(document.body)}else{setInterval(post,600)}',
    'post();setTimeout(post,300);',
    '})();</script>',
    '</body></html>',
  ].join('')
}

/**
 * HTML Embed — renders vendor-pasted markup inside a sandboxed iframe (via
 * `srcDoc`) instead of `dangerouslySetInnerHTML`, so `<script>` tags in
 * third-party embed snippets (maps, chat widgets, forms, ad tags) actually
 * execute — `innerHTML` silently drops `<script>` tags in every browser. A
 * small injected script reports content height back via `postMessage` so
 * the iframe auto-grows to fit instead of clipping or scrolling.
 */
export default function HtmlEmbedBlock({ props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const html = String(props.html ?? '')

  const layout = String(props.layout ?? 'standard')
  const isDark = layout === 'statement' || props.bg_style === 'dark'
  const isCard = layout === 'card' || props.card_style === 'elevated'

  const maxWidth =
    layout === 'wide' || props.max_width === 'full' ? 'max-w-7xl'
      : layout === 'narrow' || props.max_width === 'prose' ? 'max-w-2xl'
        : layout === 'centered' ? 'max-w-3xl'
          : layout === 'compact' ? 'max-w-3xl'
            : 'max-w-5xl'

  const embedIdRef = useRef('')
  if (!embedIdRef.current) embedIdRef.current = `html-embed-${blockId ?? ++embedSeq}`
  const [height, setHeight] = useState(180)

  const srcDoc = useMemo(
    () => (html.trim() ? buildSrcDoc(html, embedIdRef.current) : ''),
    [html],
  )

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { __htmlEmbedId?: string; height?: number } | undefined
      if (data?.__htmlEmbedId === embedIdRef.current && typeof data.height === 'number') {
        setHeight(Math.max(60, Math.round(data.height)))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const isEmpty = !html.trim()

  const body = isEmpty ? (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center text-sm',
        isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-400',
      )}
    >
      <Code2 className="w-5 h-5 opacity-60" aria-hidden="true" />
      {isEditorCanvas
        ? 'Paste custom HTML, an embed snippet, or a widget script in the panel to see it here.'
        : null}
    </div>
  ) : (
    <iframe
      key={embedIdRef.current}
      title="Custom embed"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation"
      className="w-full block border-0"
      style={{ height: `${height}px` }}
      loading="lazy"
    />
  )

  const shellClass = isDark
    ? 'border-slate-700 bg-slate-800/60'
    : 'border-gray-200 bg-white'

  return (
    <div className="w-full" style={isDark ? { background: '#0f172a' } : undefined}>
      <section className={builderSectionContainerWithMax(maxWidth)}>
        {isCard ? (
          <div className={cn('rounded-2xl border p-4 sm:p-5 shadow-sm', shellClass)}>{body}</div>
        ) : (
          body
        )}
      </section>
    </div>
  )
}
