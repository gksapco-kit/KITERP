import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { mergeNavbarProps, resolveNavbarLinks } from '../../lib/navbarDefaults'
import type { Block, NavbarNavLink } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function SectionHeader({
  title,
  onRemove,
}: {
  title: string
  onRemove: () => void
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-gray-800">{title}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        title={`Remove ${title.toLowerCase()} from navbar`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  )
}

interface NavbarPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function NavbarPropertiesFields({ block, onChange }: NavbarPropertiesFieldsProps) {
  const p = mergeNavbarProps(block.props)
  const links = resolveNavbarLinks(p)

  const updateLink = (index: number, patch: Partial<NavbarNavLink>) => {
    const next = [...links]
    next[index] = { ...next[index], ...patch }
    onChange({ navbarLinks: next, items: next.map((l) => l.label) })
  }

  const removeLink = (index: number) => {
    const next = links.filter((_, i) => i !== index)
    onChange({ navbarLinks: next, items: next.map((l) => l.label) })
  }

  const removed: { key: string; label: string; restore: () => void }[] = []
  if (p.navbarShowLogo === false) {
    removed.push({ key: 'logo', label: 'Logo', restore: () => onChange({ navbarShowLogo: true }) })
  }
  if (p.navbarShowLinks === false) {
    removed.push({ key: 'links', label: 'Menu links', restore: () => onChange({ navbarShowLinks: true }) })
  }
  if (p.navbarShowSearch === false) {
    removed.push({ key: 'search', label: 'Search bar', restore: () => onChange({ navbarShowSearch: true }) })
  }
  if (p.navbarShowLogin === false) {
    removed.push({ key: 'login', label: 'Log in button', restore: () => onChange({ navbarShowLogin: true }) })
  }
  if (p.navbarShowCart === false) {
    removed.push({ key: 'cart', label: 'Cart', restore: () => onChange({ navbarShowCart: true }) })
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Navbar</p>
      <p className="text-xs text-gray-500">
        Logo, menu, search, login, and cart. Use <strong>Remove</strong> on each section to hide it from the bar.
      </p>

      {p.navbarShowLogo !== false && (
        <section className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <SectionHeader title="Logo" onRemove={() => onChange({ navbarShowLogo: false })} />
          <div className="space-y-3">
            <Field label="Brand name">
              <input
                className={inputClass}
                value={p.companyName ?? ''}
                onChange={(e) => onChange({ companyName: e.target.value })}
              />
            </Field>
            <ImageUploadField
              label="Logo image (optional)"
              value={p.navbarLogoUrl}
              onChange={(url) => onChange({ navbarLogoUrl: url })}
            />
            <p className="text-[11px] text-gray-400">Without an image, the first letter of the brand name is used.</p>
          </div>
        </section>
      )}

      {p.navbarShowLinks !== false && (
        <section className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <SectionHeader title="Menu links" onRemove={() => onChange({ navbarShowLinks: false })} />
          <div className="space-y-2">
            {links.map((link, index) => (
              <div key={link.id} className="flex gap-2">
                <input
                  className={inputClass}
                  value={link.label}
                  onChange={(e) => updateLink(index, { label: e.target.value })}
                  placeholder="Label"
                />
                <input
                  className={inputClass}
                  value={link.link ?? ''}
                  onChange={(e) => updateLink(index, { link: e.target.value || undefined })}
                  placeholder="#contact (optional)"
                />
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="shrink-0 rounded-lg border border-gray-200 px-2 text-gray-400 hover:border-red-200 hover:text-red-600"
                  aria-label="Delete link"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              onClick={() => {
                const next = [...links, { id: uuid(), label: 'New link' }]
                onChange({ navbarLinks: next, items: next.map((l) => l.label) })
              }}
            >
              <Plus className="h-3 w-3" /> Add link
            </button>
          </div>
        </section>
      )}

      {p.navbarShowSearch !== false && (
        <section className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <SectionHeader title="Search bar" onRemove={() => onChange({ navbarShowSearch: false })} />
          <Field label="Placeholder text">
            <input
              className={inputClass}
              value={p.navbarSearchPlaceholder ?? ''}
              onChange={(e) => onChange({ navbarSearchPlaceholder: e.target.value })}
              placeholder="Search products…"
            />
          </Field>
        </section>
      )}

      {p.navbarShowLogin !== false && (
        <section className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <SectionHeader title="Log in button" onRemove={() => onChange({ navbarShowLogin: false })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Button text">
              <input
                className={inputClass}
                value={p.navbarLoginText ?? ''}
                onChange={(e) => onChange({ navbarLoginText: e.target.value })}
              />
            </Field>
            <Field label="Link">
              <input
                className={inputClass}
                value={p.navbarLoginLink ?? ''}
                onChange={(e) => onChange({ navbarLoginLink: e.target.value })}
                placeholder="#login or login"
              />
            </Field>
          </div>
        </section>
      )}

      {p.navbarShowCart !== false && (
        <section className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <SectionHeader title="Cart" onRemove={() => onChange({ navbarShowCart: false })} />
          <p className="text-xs text-gray-500">
            Shows cart icon with item count and total. Links to the cart page when clicked.
          </p>
        </section>
      )}

      {removed.length > 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">Removed from navbar</p>
          <div className="flex flex-wrap gap-2">
            {removed.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.restore}
                className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700"
              >
                <Plus className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
