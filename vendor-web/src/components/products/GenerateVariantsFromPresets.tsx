import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useProductVariantPresets } from '@/hooks/useProductVariantPresets'
import type { ColourPreset, SizePreset } from '@/lib/productVariantPresets'
import { cn } from '@/lib/utils'
import { ChevronDown, Layers } from 'lucide-react'

export type GeneratedVariantCombo = {
  name: string
  attrs: Record<string, string>
  colorHex?: string
}

export function buildVariantCombos(
  colours: ColourPreset[],
  sizes: SizePreset[],
): GeneratedVariantCombo[] {
  if (colours.length > 0 && sizes.length > 0) {
    return colours.flatMap(c =>
      sizes.map(s => ({
        name: `${c.name}(${s.value})`,
        attrs: { Color: c.name, Size: s.size, Value: s.value },
        colorHex: c.hex,
      })),
    )
  }
  if (colours.length > 0) {
    return colours.map(c => ({
      name: c.name,
      attrs: { Color: c.name },
      colorHex: c.hex,
    }))
  }
  return sizes.map(s => ({
    name: s.value || s.size,
    attrs: { Size: s.size, Value: s.value },
  }))
}

export function PresetMaterialMultiSelect<T extends { id: string }>({
  id,
  label,
  placeholder,
  emptyMessage,
  options,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  getLabel,
  renderOption,
  dense = false,
  multiple = true,
  maxVisibleLabels = 2,
}: {
  id: string
  label: string
  placeholder: string
  emptyMessage: string
  options: T[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSelectAll?: () => void
  onClear?: () => void
  getLabel: (option: T) => string
  renderOption: (option: T, checked: boolean) => ReactNode
  dense?: boolean
  multiple?: boolean
  maxVisibleLabels?: number
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const selectedLabels = useMemo(
    () => options.filter(o => selectedIds.has(o.id)).map(getLabel),
    [options, selectedIds, getLabel],
  )

  const displayValue = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length <= maxVisibleLabels
      ? selectedLabels.join(', ')
      : `${selectedLabels.slice(0, maxVisibleLabels).join(', ')} +${selectedLabels.length - maxVisibleLabels}`

  const updateMenuPos = () => {
    if (!rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, dense ? 256 : 288),
    })
  }

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
    window.addEventListener('scroll', updateMenuPos, true)
    window.addEventListener('resize', updateMenuPos)
    return () => {
      window.removeEventListener('scroll', updateMenuPos, true)
      window.removeEventListener('resize', updateMenuPos)
    }
  }, [open, dense])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const menu = open && menuPos && options.length > 0 ? (
    <div
      ref={menuRef}
      className="fixed z-[9999] rounded-lg border border-border bg-popover shadow-xl"
      style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
      role="listbox"
      aria-multiselectable={multiple}
      aria-label={`${label} options`}
      onMouseDown={e => e.stopPropagation()}
    >
      {multiple && onSelectAll && onClear && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button type="button" className="text-[11px] font-medium text-primary hover:underline" onClick={onSelectAll}>
              All
            </button>
            <button type="button" className="text-[11px] text-muted-foreground hover:underline" onClick={onClear}>
              Clear
            </button>
          </div>
        </div>
      )}
      <ul className={cn('overflow-y-auto py-1', dense ? 'max-h-44' : 'max-h-52')}>
        {options.map(option => {
          const checked = selectedIds.has(option.id)
          return (
            <li key={option.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 px-3 text-sm',
                  dense ? 'py-2' : 'py-2.5',
                  checked ? 'bg-primary/10' : 'hover:bg-muted/60',
                )}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-primary focus:ring-0"
                />
                {renderOption(option, checked)}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  ) : null

  return (
    <div ref={rootRef} className={cn('relative flex', dense && 'w-[16rem] sm:w-[18rem] md:w-[20rem] shrink-0')}>
      <button
        id={id}
        type="button"
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          if (options.length > 0) setOpen(v => !v)
        }}
        className={cn(
          'group w-full rounded-md border bg-background text-left transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0',
          dense ? 'flex h-full min-h-[2.25rem] flex-col justify-center px-2.5 py-1' : 'px-3 py-2',
          open
            ? 'border-primary ring-2 ring-primary/15'
            : 'border-input hover:border-gray-400',
          options.length === 0 && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className={cn(
          'block font-medium uppercase tracking-wide text-muted-foreground',
          dense ? 'text-[9px] leading-none mb-0.5' : 'text-[11px] mb-1',
        )}>
          {label}
        </span>
        <span className={cn('flex items-center justify-between gap-1.5', dense ? 'min-h-[1rem]' : 'min-h-[1.5rem]')}>
          <span
            className={cn(
              'truncate',
              dense ? 'text-[11px] leading-tight' : 'text-sm',
              selectedLabels.length === 0 ? 'text-muted-foreground' : 'text-foreground font-medium',
            )}
          >
            {options.length === 0 ? emptyMessage : displayValue}
          </span>
          <ChevronDown
            className={cn(
              'shrink-0 text-muted-foreground transition-transform duration-200',
              dense ? 'h-3 w-3' : 'h-4 w-4',
              open && 'rotate-180 text-primary',
            )}
          />
        </span>
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  )
}

type PresetFieldProps = {
  vendorId?: string
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  dense?: boolean
  multiple?: boolean
  idSuffix?: string
  /** When generating combos, show each colour as Name(count) e.g. Red(5). */
  pairCount?: number
}

export function PresetColourField({
  vendorId,
  selectedIds,
  onSelectedIdsChange,
  dense = true,
  multiple = true,
  idSuffix = '',
  pairCount,
}: PresetFieldProps) {
  const { presets } = useProductVariantPresets(vendorId)

  const toggle = (id: string) => {
    onSelectedIdsChange(
      multiple
        ? (() => {
            const next = new Set(selectedIds)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })()
        : new Set(selectedIds.has(id) ? [] : [id]),
    )
  }

  return (
    <PresetMaterialMultiSelect
      id={`variant-colour${idSuffix}`}
      label="Colour"
      placeholder="Select…"
      emptyMessage="None"
      options={presets.colours}
      selectedIds={selectedIds}
      onToggle={toggle}
      onSelectAll={multiple ? () => onSelectedIdsChange(new Set(presets.colours.map(c => c.id))) : undefined}
      onClear={multiple ? () => onSelectedIdsChange(new Set()) : undefined}
      getLabel={c => (pairCount && pairCount > 0 && multiple ? `${c.name}(${pairCount})` : c.name)}
      dense={dense}
      multiple={multiple}
      maxVisibleLabels={4}
      renderOption={(c) => (
        <>
          <span
            className={cn('shrink-0 rounded-full border border-gray-200', dense ? 'h-3 w-3' : 'h-5 w-5')}
            style={{ backgroundColor: c.hex }}
            title={c.hex}
          />
          <span className={cn('font-medium truncate', dense && 'text-xs')}>{c.name}</span>
        </>
      )}
    />
  )
}

export function PresetSizeField({
  vendorId,
  selectedIds,
  onSelectedIdsChange,
  dense = true,
  multiple = true,
  idSuffix = '',
}: PresetFieldProps) {
  const { presets } = useProductVariantPresets(vendorId)

  const toggle = (id: string) => {
    onSelectedIdsChange(
      multiple
        ? (() => {
            const next = new Set(selectedIds)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })()
        : new Set(selectedIds.has(id) ? [] : [id]),
    )
  }

  return (
    <PresetMaterialMultiSelect
      id={`variant-size${idSuffix}`}
      label="Size"
      placeholder="Select…"
      emptyMessage="None"
      options={presets.sizes}
      selectedIds={selectedIds}
      onToggle={toggle}
      onSelectAll={multiple ? () => onSelectedIdsChange(new Set(presets.sizes.map(s => s.id))) : undefined}
      onClear={multiple ? () => onSelectedIdsChange(new Set()) : undefined}
      getLabel={s => s.value || s.size}
      dense={dense}
      multiple={multiple}
      maxVisibleLabels={4}
      renderOption={(s) => (
        <span className={cn('truncate', dense && 'text-[11px] leading-tight')}>
          <span className="font-medium">{s.size}</span>
          <span className="text-muted-foreground"> · {s.value}</span>
        </span>
      )}
    />
  )
}

type GenerateButtonProps = {
  vendorId?: string
  selectedColourIds: Set<string>
  selectedSizeIds: Set<string>
  onGenerate: (combos: GeneratedVariantCombo[]) => void
  compact?: boolean
  prominent?: boolean
}

export function GenerateVariantsButton({
  vendorId,
  selectedColourIds,
  selectedSizeIds,
  onGenerate,
  compact = true,
  prominent = false,
}: GenerateButtonProps) {
  const { presets } = useProductVariantPresets(vendorId)

  const selectedColours = useMemo(
    () => presets.colours.filter(c => selectedColourIds.has(c.id)),
    [presets.colours, selectedColourIds],
  )
  const selectedSizes = useMemo(
    () => presets.sizes.filter(s => selectedSizeIds.has(s.id)),
    [presets.sizes, selectedSizeIds],
  )

  const comboCount = useMemo(() => {
    if (selectedColours.length === 0 && selectedSizes.length === 0) return 0
    if (selectedColours.length > 0 && selectedSizes.length > 0) {
      return selectedColours.length * selectedSizes.length
    }
    return selectedColours.length || selectedSizes.length
  }, [selectedColours.length, selectedSizes.length])

  const handleGenerate = () => {
    if (selectedColours.length === 0 && selectedSizes.length === 0) return
    onGenerate(buildVariantCombos(selectedColours, selectedSizes))
  }

  return (
    <Button
      type="button"
      variant={prominent ? 'default' : 'secondary'}
      size={prominent ? undefined : 'sm'}
      className={cn(
        prominent && '!h-full min-h-[2.25rem] self-stretch rounded-md px-3 text-xs shadow-sm',
        !prominent && compact && 'h-8 px-2.5 text-xs',
      )}
      disabled={comboCount === 0}
      onClick={handleGenerate}
      title={comboCount > 0 ? `Create ${comboCount} variant(s)` : 'Select at least one colour or size'}
    >
      <Layers className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      Generate
      {comboCount > 0 && (
        <span className="tabular-nums opacity-90">({comboCount})</span>
      )}
    </Button>
  )
}

type Props = {
  vendorId?: string
  onGenerate: (combos: GeneratedVariantCombo[]) => void
  inline?: boolean
}

/** @deprecated Prefer PresetColourField + PresetSizeField in variant row + GenerateVariantsButton in toolbar */
export function GenerateVariantsFromPresets({ vendorId, onGenerate, inline = false }: Props) {
  const navigate = useNavigate()
  const { presets } = useProductVariantPresets(vendorId)
  const [selectedColourIds, setSelectedColourIds] = useState<Set<string>>(new Set())
  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<string>>(new Set())

  const noPresets = presets.colours.length === 0 && presets.sizes.length === 0

  if (noPresets) {
    return (
      <p className={cn('text-xs text-muted-foreground', inline && 'max-w-md')}>
        Save colours on the{' '}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => navigate('/products/colours')}>
          Colours
        </button>{' '}
        page and sizes on the{' '}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => navigate('/products/sizes')}>
          Sizes
        </button>{' '}
        page first.
      </p>
    )
  }

  return (
    <div className={cn(inline ? 'flex flex-wrap items-end gap-2 sm:gap-3' : 'space-y-4')}>
      <PresetColourField
        vendorId={vendorId}
        selectedIds={selectedColourIds}
        onSelectedIdsChange={setSelectedColourIds}
        dense={inline}
      />
      <PresetSizeField
        vendorId={vendorId}
        selectedIds={selectedSizeIds}
        onSelectedIdsChange={setSelectedSizeIds}
        dense={inline}
      />
      <GenerateVariantsButton
        vendorId={vendorId}
        selectedColourIds={selectedColourIds}
        selectedSizeIds={selectedSizeIds}
        onGenerate={onGenerate}
        compact={inline}
      />
    </div>
  )
}
