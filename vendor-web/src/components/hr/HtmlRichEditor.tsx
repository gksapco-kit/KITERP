import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Table, FilePlus,
} from 'lucide-react'
import { OFFER_PAGE_BREAK } from '@/lib/offerPages'

function ToolbarBtn({
  onClick, title, children,
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
      className="p-1.5 rounded border border-transparent text-gray-600 hover:bg-gray-100 transition-colors"
    >
      {children}
    </button>
  )
}

export type HtmlRichEditorHandle = { insertText: (text: string) => void }

export const HtmlRichEditor = forwardRef<HtmlRichEditorHandle, {
  value: string
  onChange: (html: string) => void
  editorKey?: string
  placeholder?: string
  className?: string
}>(function HtmlRichEditor({
  value,
  onChange,
  editorKey,
  placeholder,
  className = '',
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      editorRef.current?.focus()
      document.execCommand('insertText', false, text)
      const html = editorRef.current?.innerHTML ?? ''
      onChange(html === '<br>' ? '' : html)
    },
  }), [onChange])

  // Only reset editor HTML when switching templates — or when value changes externally (e.g. preview edit).
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const focused = document.activeElement === el || el.contains(document.activeElement)
    if (focused) return
    const next = value || ''
    if (el.innerHTML !== next) el.innerHTML = next
  }, [value, editorKey])

  const sync = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? ''
    onChange(html === '<br>' ? '' : html)
  }, [onChange])

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    sync()
  }, [sync])

  const insertTable = () => {
    exec('insertHTML', `<table><tr><th>Field</th><th>Value</th></tr><tr><td>CTC</td><td>{{offered_ctc}}</td></tr></table>`)
  }

  const insertPageBreak = () => {
    exec('insertHTML', `${OFFER_PAGE_BREAK}<p></p>`)
  }

  return (
    <div className={`flex flex-col border rounded-lg overflow-hidden bg-white ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-gray-50 shrink-0">
        <ToolbarBtn onClick={() => exec('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('underline')} title="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
        <span className="w-px h-5 bg-gray-200 mx-0.5" />
        <ToolbarBtn onClick={() => exec('formatBlock', 'h1')} title="Heading 1"><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('formatBlock', 'h2')} title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
        <span className="w-px h-5 bg-gray-200 mx-0.5" />
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={insertTable} title="Insert table"><Table className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={insertPageBreak} title="New page (page break)"><FilePlus className="w-3.5 h-3.5" /></ToolbarBtn>
        <span className="w-px h-5 bg-gray-200 mx-0.5" />
        <ToolbarBtn onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyRight')} title="Align right"><AlignRight className="w-3.5 h-3.5" /></ToolbarBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        className="flex-1 min-h-[280px] px-3 py-2 text-sm outline-none overflow-y-auto prose prose-sm max-w-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400"
      />
    </div>
  )
})
