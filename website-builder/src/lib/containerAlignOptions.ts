import type { ContainerAlign, ContainerLayout } from '../types/builder'

export interface AlignChoice {
  value: ContainerAlign | ''
  label: string
  shortLabel: string
}

export function horizontalAlignChoices(inherit?: boolean): AlignChoice[] {
  const base: AlignChoice[] = [
    { value: 'start', label: 'Left', shortLabel: 'Left' },
    { value: 'center', label: 'Center', shortLabel: 'Center' },
    { value: 'end', label: 'Right', shortLabel: 'Right' },
    { value: 'stretch', label: 'Fill width', shortLabel: 'Fill' },
  ]
  if (inherit) {
    return [{ value: '', label: 'Same as container', shortLabel: 'Auto' }, ...base]
  }
  return base
}

export function verticalAlignChoices(inherit?: boolean): AlignChoice[] {
  const base: AlignChoice[] = [
    { value: 'start', label: 'Top', shortLabel: 'Top' },
    { value: 'center', label: 'Center', shortLabel: 'Center' },
    { value: 'end', label: 'Bottom', shortLabel: 'Bottom' },
    { value: 'stretch', label: 'Fill height', shortLabel: 'Fill' },
  ]
  if (inherit) {
    return [{ value: '', label: 'Same as container', shortLabel: 'Auto' }, ...base]
  }
  return base
}

export function containerAlignHint(layout: ContainerLayout, scope: 'container' | 'child'): string {
  if (scope === 'child') {
    return layout === 'column'
      ? 'Overrides the container default for this block only. Auto keeps the container’s horizontal & vertical settings.'
      : 'Overrides the container default for this block only. Useful when map and form should align differently in the same row.'
  }
  if (layout === 'column') {
    return 'Applies to every block in this container. Horizontal = left/center/right of each row. Vertical = top/center/bottom along the stack.'
  }
  if (layout === 'grid') {
    return 'Applies to every block in this container. Horizontal = position in each grid cell (left/center/right). Vertical = top/center/bottom in the cell.'
  }
  return 'Applies to every block in this container. Horizontal = left/center/right in each column. Vertical = top/center/bottom when columns have different heights (e.g. map + form).'
}

export function horizontalAxisTitle(layout: ContainerLayout): string {
  return layout === 'column' ? 'Horizontal (left ↔ right)' : 'Horizontal (left ↔ right in each column)'
}

export function verticalAxisTitle(layout: ContainerLayout): string {
  return layout === 'column' ? 'Vertical (top ↕ bottom along stack)' : 'Vertical (top ↕ bottom in each column)'
}
