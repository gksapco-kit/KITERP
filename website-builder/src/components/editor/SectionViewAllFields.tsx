import { parseLinkToSlug } from '../../lib/buttonNavigation'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface SectionViewAllFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function SectionViewAllFields({ block, onChange }: SectionViewAllFieldsProps) {
  const pages = useBuilderStore((s) => s.pages)
  const p = block.props
  const show = p.showViewAllButton === true
  const link = p.viewAllButtonLink ?? ''
  const selectedSlug = pages.some((page) => page.slug === parseLinkToSlug(link, pages))
    ? parseLinkToSlug(link, pages)
    : ''

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">View all button</p>
      <ToggleField
        label="Show view all button"
        checked={show}
        onChange={(showViewAllButton) => onChange({ showViewAllButton })}
      />
      {show && (
        <>
          <Field label="Button text">
            <input
              className={inputClass}
              value={p.viewAllButtonText ?? 'View all'}
              onChange={(e) => onChange({ viewAllButtonText: e.target.value })}
              placeholder="View all"
            />
          </Field>
          <Field label="Go to page" hint="Choose a page from your site. Works in preview and on the live site.">
            <select
              className={inputClass}
              value={selectedSlug}
              onChange={(e) => onChange({ viewAllButtonLink: `#${e.target.value}` })}
            >
              <option value="" disabled>
                Select a page…
              </option>
              {pages.map((page) => (
                <option key={page.id} value={page.slug}>
                  {page.name} ({page.slug})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Custom link (optional)" hint="Overrides page select. Use #services, #products, or a full URL.">
            <input
              className={inputClass}
              value={link}
              onChange={(e) => onChange({ viewAllButtonLink: e.target.value })}
              placeholder="#services"
            />
          </Field>
        </>
      )}
    </div>
  )
}
