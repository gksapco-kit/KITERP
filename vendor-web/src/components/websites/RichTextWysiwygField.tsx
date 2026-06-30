import { useCallback, useEffect, useRef } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function stripHtmlPreview(html: string, max = 56): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 'Empty'
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function ToolbarBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className="p-1.5 rounded border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  )
}

export function RichTextWysiwygField({
  blockId,
  serverValue,
  onCommit,
  onPreview,
}: {
  blockId: string
  serverValue: string
  onCommit: (html: string) => void
  onPreview: (html: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)
  const savedRangeRef = useRef<Range | null>(null)

  const normalizeHtml = useCallback((html: string) => (html === '<br>' ? '' : html), [])

  const saveSelection = useCallback(() => {
    const editor = editorRef.current
    const sel = window.getSelection()
    if (!editor || !sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) return
    savedRangeRef.current = range.cloneRange()
  }, [])

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current
    const range = savedRangeRef.current
    if (!editor || !range) return false
    try {
      if (!editor.contains(range.commonAncestorContainer)) return false
      const sel = window.getSelection()
      if (!sel) return false
      sel.removeAllRanges()
      sel.addRange(range)
      return true
    } catch {
      return false
    }
  }, [])

  const ensureBlockContext = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.innerHTML.trim()
    if (!html || html === '<br>') {
      editor.innerHTML = '<p><br></p>'
      const p = editor.querySelector('p')
      if (!p) return
      const range = document.createRange()
      range.setStart(p, 0)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
  }, [])

  useEffect(() => {
    if (isEditingRef.current) return
    const el = editorRef.current
    if (!el) return
    const next = serverValue || ''
    if (el.innerHTML !== next) el.innerHTML = next
  }, [blockId, serverValue])

  const readHtml = useCallback(() => normalizeHtml(editorRef.current?.innerHTML ?? ''), [normalizeHtml])

  const syncPreview = useCallback(() => {
    isEditingRef.current = true
    onPreview(readHtml())
  }, [onPreview, readHtml])

  const syncCommit = useCallback(() => {
    isEditingRef.current = false
    onCommit(readHtml())
  }, [onCommit, readHtml])

  const exec = useCallback((cmd: string, val?: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    ensureBlockContext()
    restoreSelection()
    let arg = val
    if (cmd === 'formatBlock' && val && !val.startsWith('<')) {
      arg = `<${val}>`
    }
    document.execCommand(cmd, false, arg)
    saveSelection()
    syncPreview()
  }, [ensureBlockContext, restoreSelection, saveSelection, syncPreview])

  const insertLink = useCallback(() => {
    saveSelection()
    const url = window.prompt('Link URL', 'https://')
    if (!url?.trim()) return
    exec('createLink', url.trim())
  }, [exec, saveSelection])

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground truncate" title={stripHtmlPreview(serverValue, 200)}>
        {stripHtmlPreview(serverValue)}
      </p>
      <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card">
        <div
          className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40 shrink-0"
          onMouseDown={e => e.preventDefault()}
        >
          <ToolbarBtn onClick={() => exec('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('underline')} title="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-5 bg-border mx-0.5" />
          <ToolbarBtn onClick={() => exec('formatBlock', 'p')} title="Paragraph"><span className="text-[10px] font-bold px-0.5">P</span></ToolbarBtn>
          <span className="w-px h-5 bg-border mx-0.5" />
          <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={insertLink} title="Insert link"><Link2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-5 bg-border mx-0.5" />
          <ToolbarBtn onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('justifyRight')} title="Align right"><AlignRight className="w-3.5 h-3.5" /></ToolbarBtn>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => { isEditingRef.current = true }}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onInput={() => { saveSelection(); syncPreview() }}
          onBlur={syncCommit}
          data-placeholder="Write your content…"
          className={cn(
            'rich-text-content min-h-[220px] max-h-[420px] px-3 py-2.5 text-sm outline-none overflow-y-auto',
            '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground',
          )}
        />
      </div>
    </div>
  )
}
