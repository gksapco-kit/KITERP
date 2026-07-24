export {
  ThemeSelect as Select,
  themeSelectUi,
  type ThemeSelectOption as SelectOption,
  type ThemeSelectProps as SelectProps,
} from '@/components/common/ThemeSelect'

/** Build options with a leading blank / "all" row */
export function selectOptionsWithBlank(
  blankLabel: string,
  items: { value: string; label: string }[],
) {
  return [{ value: '', label: blankLabel }, ...items]
}
