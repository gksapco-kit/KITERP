import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { MAX_VARIANT_COMBINATIONS } from '@/lib/variantOptionTypes'

// ── Client-side hierarchy model ──────────────────────────────────────
// A group (e.g. "Processor") holds a tree of options. Each root-to-leaf
// path (Intel -> i7 -> 14th Gen) is one selectable value for the group.
// Generated variants are the cartesian product of every group's leaves.
export interface HierOption {
  id: string
  label: string
  priceDelta: number
  children: HierOption[]
}

export interface HierGroup {
  id: string
  name: string
  options: HierOption[]
}

export interface HierCombo {
  /** e.g. "Intel i7 14th Gen / Z790" */
  name: string
  /** e.g. { Processor: "Intel i7 14th Gen", Motherboard: "Z790" } */
  attrs: Record<string, string>
  /** sum of price deltas along every selected leaf path */
  priceDelta: number
}

let _uidSeed = 0
const uid = () => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* fall through */ }
  _uidSeed += 1
  return `h_${Date.now().toString(36)}_${_uidSeed}`
}

const newOption = (label = ''): HierOption => ({ id: uid(), label, priceDelta: 0, children: [] })
const newGroup = (name = ''): HierGroup => ({ id: uid(), name, options: [] })

/** Root-to-leaf paths for one group's option tree. */
function leafPaths(
  options: HierOption[],
  prefixLabels: string[],
  prefixDelta: number,
): { labels: string[]; delta: number }[] {
  const out: { labels: string[]; delta: number }[] = []
  for (const o of options) {
    const label = o.label.trim()
    if (!label) continue
    const labels = [...prefixLabels, label]
    const delta = prefixDelta + (Number(o.priceDelta) || 0)
    if (o.children.length === 0) out.push({ labels, delta })
    else out.push(...leafPaths(o.children, labels, delta))
  }
  return out
}

/** Cartesian product of all groups' leaf paths -> variant combos. */
export function buildHierarchyCombos(groups: HierGroup[]): HierCombo[] {
  const usable = groups
    .map(g => ({ name: g.name.trim(), leaves: leafPaths(g.options, [], 0) }))
    .filter(g => g.name && g.leaves.length > 0)
  if (usable.length === 0) return []

  let acc: { parts: { group: string; value: string }[]; delta: number }[] = [{ parts: [], delta: 0 }]
  for (const g of usable) {
    const next: typeof acc = []
    for (const a of acc) {
      for (const leaf of g.leaves) {
        next.push({
          parts: [...a.parts, { group: g.name, value: leaf.labels.join(' ') }],
          delta: a.delta + leaf.delta,
        })
      }
    }
    acc = next
  }

  return acc.map(a => ({
    name: a.parts.map(p => p.value).join(' / '),
    attrs: Object.fromEntries(a.parts.map(p => [p.group, p.value])),
    priceDelta: a.delta,
  }))
}

// ── Immutable tree helpers ───────────────────────────────────────────
function mapOptions(
  options: HierOption[],
  id: string,
  fn: (o: HierOption) => HierOption,
): HierOption[] {
  return options.map(o =>
    o.id === id ? fn(o) : { ...o, children: mapOptions(o.children, id, fn) },
  )
}

function removeOption(options: HierOption[], id: string): HierOption[] {
  return options
    .filter(o => o.id !== id)
    .map(o => ({ ...o, children: removeOption(o.children, id) }))
}

const MAX_SAFE_COMBOS = MAX_VARIANT_COMBINATIONS // re-export alias — see variantOptionTypes

interface Props {
  onGenerate: (combos: HierCombo[], mode: 'append' | 'replace') => void
  disabled?: boolean
}

export function VariantHierarchyBuilder({ onGenerate, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<HierGroup[]>([])
  const [newGroupName, setNewGroupName] = useState('')

  const combos = useMemo(() => buildHierarchyCombos(groups), [groups])
  const comboCount = combos.length
  const tooMany = comboCount > MAX_SAFE_COMBOS

  const addGroup = () => {
    const name = newGroupName.trim()
    if (!name) return
    setGroups(prev => [...prev, newGroup(name)])
    setNewGroupName('')
  }

  const renameGroup = (groupId: string, name: string) =>
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, name } : g)))

  const deleteGroup = (groupId: string) =>
    setGroups(prev => prev.filter(g => g.id !== groupId))

  const patchGroupOptions = (groupId: string, fn: (opts: HierOption[]) => HierOption[]) =>
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, options: fn(g.options) } : g)))

  const addRootOption = (groupId: string) =>
    patchGroupOptions(groupId, opts => [...opts, newOption('')])

  const addChildOption = (groupId: string, parentId: string) =>
    patchGroupOptions(groupId, opts =>
      mapOptions(opts, parentId, o => ({ ...o, children: [...o.children, newOption('')] })),
    )

  const editOptionLabel = (groupId: string, optionId: string, label: string) =>
    patchGroupOptions(groupId, opts => mapOptions(opts, optionId, o => ({ ...o, label })))

  const editOptionDelta = (groupId: string, optionId: string, delta: number) =>
    patchGroupOptions(groupId, opts => mapOptions(opts, optionId, o => ({ ...o, priceDelta: delta })))

  const deleteOptionById = (groupId: string, optionId: string) =>
    patchGroupOptions(groupId, opts => removeOption(opts, optionId))

  const handleGenerate = (mode: 'append' | 'replace') => {
    if (comboCount === 0 || tooMany) return
    onGenerate(combos, mode)
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Generate variants from a hierarchy</span>
        {comboCount > 0 && (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {comboCount.toLocaleString('en-IN')} combos
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            Add independent groups (e.g. <strong>Processor</strong>, <strong>Motherboard</strong>). Inside a group,
            nest choices to any depth (Intel &rsaquo; i7 &rsaquo; 14th Gen). Each group&rsquo;s leaf paths are
            multiplied together to create one variant per combination.
          </p>

          <div className="space-y-3">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                disabled={disabled}
                onRename={name => renameGroup(group.id, name)}
                onDelete={() => deleteGroup(group.id)}
                onAddRoot={() => addRootOption(group.id)}
                onAddChild={parentId => addChildOption(group.id, parentId)}
                onEditLabel={(optId, label) => editOptionLabel(group.id, optId, label)}
                onEditDelta={(optId, delta) => editOptionDelta(group.id, optId, delta)}
                onDeleteOption={optId => deleteOptionById(group.id, optId)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="New group (e.g. Processor)"
              className="h-8 text-xs"
              disabled={disabled}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addGroup() }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 px-2 text-xs"
              disabled={disabled || !newGroupName.trim()}
              onClick={addGroup}
            >
              <Plus className="h-3.5 w-3.5" /> Group
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {comboCount === 0 ? (
                'Add at least one group with options to preview combinations.'
              ) : tooMany ? (
                <span className="text-red-500">
                  {comboCount.toLocaleString('en-IN')} combinations exceeds the {MAX_SAFE_COMBOS} limit — reduce options.
                </span>
              ) : (
                <>
                  Will create <strong className="text-foreground">{comboCount.toLocaleString('en-IN')}</strong> variant
                  {comboCount === 1 ? '' : 's'}
                  {combos[0] && <span className="text-muted-foreground"> — e.g. &ldquo;{combos[0].name}&rdquo;</span>}
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={disabled || comboCount === 0 || tooMany}
                onClick={() => handleGenerate('append')}
              >
                Add to variants
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={disabled || comboCount === 0 || tooMany}
                onClick={() => handleGenerate('replace')}
              >
                Replace all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Group card + recursive option rows ───────────────────────────────
function GroupCard({
  group,
  disabled,
  onRename,
  onDelete,
  onAddRoot,
  onAddChild,
  onEditLabel,
  onEditDelta,
  onDeleteOption,
}: {
  group: HierGroup
  disabled?: boolean
  onRename: (name: string) => void
  onDelete: () => void
  onAddRoot: () => void
  onAddChild: (parentId: string) => void
  onEditLabel: (optionId: string, label: string) => void
  onEditDelta: (optionId: string, delta: number) => void
  onDeleteOption: (optionId: string) => void
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-2 border-b pb-2">
        <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          value={group.name}
          onChange={e => onRename(e.target.value)}
          placeholder="Group name"
          className="h-7 flex-1 text-xs font-medium"
          disabled={disabled}
        />
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
          title="Delete group"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-0.5 pt-1.5">
        {group.options.length === 0 && (
          <p className="py-1.5 text-[11px] text-muted-foreground">
            No options yet — add a top-level choice (e.g. Intel, AMD).
          </p>
        )}
        {group.options.map(o => (
          <OptionRow
            key={o.id}
            option={o}
            depth={0}
            disabled={disabled}
            onAddChild={onAddChild}
            onEditLabel={onEditLabel}
            onEditDelta={onEditDelta}
            onDelete={onDeleteOption}
          />
        ))}
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          onClick={onAddRoot}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" /> Add option
        </button>
      </div>
    </div>
  )
}

function OptionRow({
  option,
  depth,
  disabled,
  onAddChild,
  onEditLabel,
  onEditDelta,
  onDelete,
}: {
  option: HierOption
  depth: number
  disabled?: boolean
  onAddChild: (parentId: string) => void
  onEditLabel: (optionId: string, label: string) => void
  onEditDelta: (optionId: string, delta: number) => void
  onDelete: (optionId: string) => void
}) {
  const hasChildren = option.children.length > 0
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="group flex items-center gap-1.5 rounded-md py-1 hover:bg-muted/40">
        {hasChildren
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <span className="w-3.5 shrink-0" />}
        <Input
          value={option.label}
          onChange={e => onEditLabel(option.id, e.target.value)}
          placeholder={depth === 0 ? 'e.g. Intel' : 'e.g. i7'}
          className="h-7 w-40 text-xs"
          disabled={disabled}
        />
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">+</span>
          <Input
            value={option.priceDelta ? String(option.priceDelta) : ''}
            onChange={e => onEditDelta(option.id, parseFloat(e.target.value) || 0)}
            placeholder="0"
            type="number"
            step="0.01"
            className="h-7 w-20 pl-5 text-xs"
            title="Price added to base when this option is chosen"
            disabled={disabled}
          />
        </div>
        {option.priceDelta !== 0 && (
          <span className={cn('text-[11px]', option.priceDelta > 0 ? 'text-emerald-600' : 'text-red-500')}>
            {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : formatCurrency(option.priceDelta)}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            title="Add sub-option"
            onClick={() => onAddChild(option.id)}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
            title="Delete option"
            onClick={() => onDelete(option.id)}
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      {option.children.map(c => (
        <OptionRow
          key={c.id}
          option={c}
          depth={depth + 1}
          disabled={disabled}
          onAddChild={onAddChild}
          onEditLabel={onEditLabel}
          onEditDelta={onEditDelta}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
