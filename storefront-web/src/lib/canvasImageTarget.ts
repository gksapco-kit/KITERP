/** Canvas image selection — single prop field or array item slots (multi-select). */

export type CanvasImageSlot = {
  propField?: string
  arrayKey?: string
  index?: number
  itemField?: string
}

export type ActiveCanvasImageTarget = {
  blockId: string
  slots: CanvasImageSlot[]
}

/** @deprecated Alias — selection is always a slot list (length 1 = single). */
export type CanvasImageTarget = ActiveCanvasImageTarget

export type CanvasImageArraySlot = {
  arrayKey: string
  index: number
  itemField: string
}

export function slotKey(slot: CanvasImageSlot): string {
  if (slot.propField) return `prop:${slot.propField}`
  return `arr:${slot.arrayKey}:${slot.index}:${slot.itemField}`
}

export function slotsCompatible(a: CanvasImageSlot, b: CanvasImageSlot): boolean {
  if (a.propField && b.propField) return a.propField === b.propField
  if (a.arrayKey != null && b.arrayKey != null && a.itemField && b.itemField) {
    return a.arrayKey === b.arrayKey && a.itemField === b.itemField
  }
  return false
}

export function toggleCanvasImageSlot(
  prev: ActiveCanvasImageTarget | null,
  blockId: string,
  field: string,
  opts?: { arrayKey?: string; index?: number; itemField?: string; additive?: boolean },
): ActiveCanvasImageTarget | null {
  const slot: CanvasImageSlot = (
    opts?.arrayKey != null && opts.index != null && opts.itemField
  )
    ? { arrayKey: opts.arrayKey, index: opts.index, itemField: opts.itemField }
    : { propField: field }

  if (!opts?.additive || !prev || prev.blockId !== blockId) {
    return { blockId, slots: [slot] }
  }

  const key = slotKey(slot)
  if (prev.slots.some(s => slotKey(s) === key)) {
    const next = prev.slots.filter(s => slotKey(s) !== key)
    return next.length ? { blockId, slots: next } : null
  }

  if (!prev.slots.every(s => slotsCompatible(s, slot))) {
    return { blockId, slots: [slot] }
  }

  return { blockId, slots: [...prev.slots, slot] }
}

export function canvasImageArraySlots(
  target: ActiveCanvasImageTarget | null | undefined,
  blockId: string,
): CanvasImageArraySlot[] {
  if (!target || target.blockId !== blockId) return []
  return target.slots
    .filter(s => s.arrayKey != null && s.index != null && s.itemField)
    .map(s => ({
      arrayKey: s.arrayKey!,
      index: s.index!,
      itemField: s.itemField!,
    }))
}

export function canvasImageArraySlot(
  target: ActiveCanvasImageTarget | null | undefined,
  blockId: string,
): CanvasImageArraySlot | null {
  const slots = canvasImageArraySlots(target, blockId)
  return slots.length === 1 ? slots[0] : null
}

/** Style keys (fit / focal / zoom) for SectionImageControls. */
export function canvasImageStyleField(
  target: ActiveCanvasImageTarget | null | undefined,
  blockId: string,
): string | null {
  if (!target || target.blockId !== blockId || target.slots.length === 0) return null
  const slot = target.slots[0]
  if (slot.propField) return slot.propField
  const itemField = slot.itemField
  if (!itemField) return null
  if (itemField === 'src' || itemField === 'avatar_url') return 'image_url'
  return itemField
}

export function isCanvasImageSlotSelected(
  target: ActiveCanvasImageTarget | null | undefined,
  blockId: string,
  slot: {
    field?: string
    arrayKey?: string
    index?: number
    itemField?: string
  },
): boolean {
  if (!target || target.blockId !== blockId) return false
  return target.slots.some(s => slotsEqual(s, slot))
}

export function slotsEqual(
  a: CanvasImageSlot,
  slot: {
    field?: string
    arrayKey?: string
    index?: number
    itemField?: string
  },
): boolean {
  if (slot.arrayKey != null && slot.index != null && slot.itemField) {
    return a.arrayKey === slot.arrayKey && a.index === slot.index && a.itemField === slot.itemField
  }
  return a.propField === slot.field && !a.arrayKey
}

/** @deprecated Use {@link isCanvasImageSlotSelected}. */
export function isCanvasImageTargetActive(
  target: ActiveCanvasImageTarget | null | undefined,
  blockId: string,
  slot: {
    field?: string
    arrayKey?: string
    index?: number
    itemField?: string
  },
): boolean {
  return isCanvasImageSlotSelected(target, blockId, slot)
}
