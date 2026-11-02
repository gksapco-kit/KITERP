import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PremiumFieldDef } from '@/lib/premiumBlockSchemas'

type Obj = Record<string, unknown>
type Path = (string | number)[]

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'text-xs font-medium text-gray-600'
const hintCls = 'text-[11px] leading-snug text-gray-400'

function getIn(root: unknown, path: Path): unknown {
  let cur: unknown = root
  for (const k of path) {
    if (cur == null) return undefined
    cur = (cur as Obj)[k as string]
  }
  return cur
}

/** Immutable set: returns a copy of `root` with `value` written at `path`. */
function setIn<T>(root: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  const clone: unknown = Array.isArray(root) ? [...(root as unknown[])] : { ...((root as Obj) ?? {}) }
  ;(clone as Obj)[head as string] = setIn((clone as Obj)[head as string], rest, value)
  return clone as T
}

/** Text-like input that edits locally and commits on blur / Enter, so typing never fires a save per keystroke. */
function CommitInput({
  value, onCommit, multiline, placeholder, type = 'text', list,
}: {
  value: string
  onCommit: (next: string) => void
  multiline?: boolean
  placeholder?: string
  type?: 'text' | 'number'
  list?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  const commit = () => { if (local !== value) onCommit(local) }
  if (multiline) {
    return (
      <textarea
        className={cn(inputCls, 'resize-y')}
        rows={3}
        value={local}
        placeholder={placeholder}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
      />
    )
  }
  return (
    <input
      className={inputCls}
      type={type}
      list={list}
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

interface Ctx {
  renderImage: (value: string, onChange: (url: string) => void) => ReactNode
  pagePaths: string[]
  /** write a new value at a path (relative to block props) */
  write: (path: Path, value: unknown) => void
  props: Obj
}

function FieldRow({ def, path, ctx }: { def: PremiumFieldDef; path: Path; ctx: Ctx }) {
  const value = getIn(ctx.props, path)

  if (def.type === 'list') return <ListField def={def} path={path} ctx={ctx} />

  const control = (() => {
    switch (def.type) {
      case 'boolean':
        return (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={value === true} onChange={e => ctx.write(path, e.target.checked)} />
            {def.label}
          </label>
        )
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
              onChange={e => ctx.write(path, e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-gray-200 p-0.5"
            />
            <CommitInput value={String(value ?? '')} onCommit={v => ctx.write(path, v)} placeholder="#RRGGBB" />
          </div>
        )
      case 'select':
        return (
          <select className={inputCls} value={String(value ?? def.options?.[0]?.value ?? '')} onChange={e => ctx.write(path, e.target.value)}>
            {def.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
      case 'image':
        return ctx.renderImage(String(value ?? ''), url => ctx.write(path, url))
      case 'tags':
        return (
          <CommitInput
            value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
            placeholder="e.g. Bridal, Kanchipuram"
            onCommit={v => ctx.write(path, v.split(',').map(s => s.trim()).filter(Boolean))}
          />
        )
      case 'strings':
        return (
          <CommitInput
            multiline
            value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
            onCommit={v => ctx.write(path, v.split('\n').map(s => s.trim()).filter(Boolean))}
          />
        )
      case 'number':
        return (
          <CommitInput
            type="number"
            value={value == null ? '' : String(value)}
            onCommit={v => ctx.write(path, v === '' ? undefined : Number(v))}
          />
        )
      case 'textarea':
        return <CommitInput multiline value={String(value ?? '')} placeholder={def.placeholder} onCommit={v => ctx.write(path, v)} />
      case 'url':
        return <CommitInput value={String(value ?? '')} placeholder={def.placeholder ?? '/page or /products?category=Name'} list="premium-page-paths" onCommit={v => ctx.write(path, v)} />
      default:
        return <CommitInput value={String(value ?? '')} placeholder={def.placeholder} onCommit={v => ctx.write(path, v)} />
    }
  })()

  return (
    <div className="space-y-1">
      {def.type !== 'boolean' && <label className={labelCls}>{def.label}</label>}
      {control}
      {def.hint && def.type !== 'boolean' && <p className={hintCls}>{def.hint}</p>}
    </div>
  )
}

function Fields({ defs, path, ctx }: { defs: PremiumFieldDef[]; path: Path; ctx: Ctx }) {
  const obj = (getIn(ctx.props, path) as Obj | undefined) ?? (path.length === 0 ? ctx.props : {})
  return (
    <div className="space-y-3">
      {defs.filter(d => !d.showIf || d.showIf(obj)).map(d => (
        <FieldRow key={d.key} def={d} path={[...path, d.key]} ctx={ctx} />
      ))}
    </div>
  )
}

function ListField({ def, path, ctx }: { def: PremiumFieldDef; path: Path; ctx: Ctx }) {
  const items = (getIn(ctx.props, path) as Obj[] | undefined) ?? []
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [sectionOpen, setSectionOpen] = useState(path.length === 1)
  const itemLabel = def.itemLabel ?? 'item'

  const commit = (next: Obj[]) => ctx.write(path, next)
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  const remove = (i: number) => {
    if (!window.confirm(`Remove this ${itemLabel}?`)) return
    commit(items.filter((_, k) => k !== i))
  }
  const add = () => {
    commit([...items, JSON.parse(JSON.stringify(def.defaultItem ?? {}))])
    setOpen(o => ({ ...o, [items.length]: true }))
    setSectionOpen(true)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60">
      <button
        type="button"
        onClick={() => setSectionOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-gray-700"
      >
        {sectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="flex-1">{def.label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500">{items.length}</span>
      </button>
      {sectionOpen && (
        <div className="space-y-2 border-t border-gray-200 p-2">
          {items.length === 0 && <p className={cn(hintCls, 'px-1')}>Nothing here yet.</p>}
          {items.map((item, i) => {
            const title = String(item?.[def.titleKey ?? ''] ?? '').trim() || `${itemLabel} ${i + 1}`
            const isOpen = open[i] === true
            return (
              <div key={i} className="rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setOpen(o => ({ ...o, [i]: !isOpen }))}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-medium text-gray-800"
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{title}</span>
                  </button>
                  <button type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                  <button type="button" title="Remove" onClick={() => remove(i)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100 p-3">
                    <Fields defs={def.fields ?? []} path={[...path, i]} ctx={ctx} />
                  </div>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={add}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Add {itemLabel}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Schema-driven editor for the premium blocks. `onUpdate` receives a top-level props patch.
 */
export function PremiumBlockEditor({
  fields, props, onUpdate, renderImage, pagePaths = [], heading,
}: {
  fields: PremiumFieldDef[]
  props: Obj
  onUpdate: (patch: Obj) => void
  renderImage: (value: string, onChange: (url: string) => void) => ReactNode
  pagePaths?: string[]
  heading?: string
}) {
  const ctx: Ctx = {
    props,
    renderImage,
    pagePaths,
    write: (path, value) => {
      const top = path[0] as string
      const next = setIn(props, path, value)
      onUpdate({ [top]: next[top] })
    },
  }
  return (
    <div className="space-y-3 p-3">
      {heading && <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{heading}</p>}
      <datalist id="premium-page-paths">
        {pagePaths.map(p => <option key={p} value={p} />)}
      </datalist>
      <Fields defs={fields} path={[]} ctx={ctx} />
    </div>
  )
}
