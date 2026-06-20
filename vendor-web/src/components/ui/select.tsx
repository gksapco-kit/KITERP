/**
 * App-wide themed dropdown — use instead of native `<select>` for consistent
 * dark mode + all KIT templates (Template 1, Template 2, palettes).
 */
export {
  ThemeSelect as Select,
  themeSelectUi,
  type ThemeSelectOption as SelectOption,
  type ThemeSelectProps as SelectProps,
} from '@/components/common/ThemeSelect'

/** Build options with a leading "all / none" row */
export function selectOptionsWithBlank(
  blankLabel: string,
  items: { value: string; label: string; hint?: string; group?: string }[],
) {
  return [{ value: '', label: blankLabel }, ...items]
}
