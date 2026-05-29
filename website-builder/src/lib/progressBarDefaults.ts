import { v4 as uuid } from 'uuid'
import type { ProgressBarItem } from '../types/builder'

export const PROGRESS_BAR_DEFAULTS = {
  progressBarLayout: 'goal' as const,
  progressBarHeight: 'md' as const,
  progressPercent: 68,
  progressLabel: 'Cart total',
  progressValueLabel: '$68 / $100',
  progressCurrent: '$68',
  progressTarget: '$100',
  showProgressPercent: true,
  showProgressValue: true,
  progressBarColor: '#4f46e5',
}

export function createProgressBarItem(overrides: Partial<ProgressBarItem> = {}): ProgressBarItem {
  return {
    id: uuid(),
    label: 'Step',
    value: 50,
    completed: false,
    enabled: true,
    ...overrides,
  }
}

export function defaultProgressSteps(): ProgressBarItem[] {
  return [
    { id: 'placed', label: 'Order placed', completed: true, enabled: true },
    { id: 'processing', label: 'Processing', completed: true, enabled: true },
    { id: 'shipped', label: 'Shipped', completed: false, enabled: true },
    { id: 'delivered', label: 'Delivered', completed: false, enabled: true },
  ]
}

export function defaultStackedProgressItems(): ProgressBarItem[] {
  return [
    { id: 'a', label: 'Organic cotton', value: 92, enabled: true },
    { id: 'b', label: 'Recycled packaging', value: 78, enabled: true },
    { id: 'c', label: 'Carbon neutral shipping', value: 64, enabled: true },
  ]
}

export function defaultProgressBarProps() {
  return {
    text: 'Free shipping progress',
    subtitle: 'Add a little more to unlock free delivery',
    progressItems: defaultProgressSteps(),
    ...PROGRESS_BAR_DEFAULTS,
  }
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
}
