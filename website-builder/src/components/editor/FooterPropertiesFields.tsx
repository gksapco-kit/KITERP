import { Plus, Trash2 } from 'lucide-react'
import type { Block, FooterColumn, FooterLink, FooterSocialLink } from '../../types/builder'

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

interface FooterPropertiesFieldsProps {
  block: Block
  variant: 'full' | 'minimal'
  onChange: (props: Partial<Block['props']>) => void
}

export function FooterPropertiesFields({ block, variant, onChange }: FooterPropertiesFieldsProps) {
  const p = block.props

  const updateColumn = (index: number, col: FooterColumn) => {
    const cols = [...(p.footerColumns ?? [])]
    cols[index] = col
    onChange({ footerColumns: cols })
  }

  const updateColumnLink = (colIndex: number, linkIndex: number, link: FooterLink) => {
    const cols = [...(p.footerColumns ?? [])]
    const links = [...(cols[colIndex]?.links ?? [])]
    links[linkIndex] = link
    cols[colIndex] = { ...cols[colIndex], links }
    onChange({ footerColumns: cols })
  }

  const removeColumnLink = (colIndex: number, linkIndex: number) => {
    const cols = [...(p.footerColumns ?? [])]
    const col = cols[colIndex]
    if (!col) return
    updateColumn(colIndex, { ...col, links: col.links.filter((_, i) => i !== linkIndex) })
  }

  const updateSocial = (index: number, social: FooterSocialLink) => {
    const list = [...(p.socialLinks ?? [])]
    list[index] = social
    onChange({ socialLinks: list })
  }

  const updateLegal = (index: number, link: FooterLink) => {
    const list = [...(p.legalLinks ?? [])]
    list[index] = link
    onChange({ legalLinks: list })
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Footer content</p>

      <Field label="Company name">
        <input className={inputClass} value={p.companyName ?? ''} onChange={(e) => onChange({ companyName: e.target.value })} />
      </Field>

      {variant === 'full' && (
        <>
          <Field label="Tagline">
            <textarea className={inputClass} rows={2} value={p.tagline ?? ''} onChange={(e) => onChange({ tagline: e.target.value })} />
          </Field>

          <Field label="Email">
            <input className={inputClass} type="email" value={p.email ?? ''} onChange={(e) => onChange({ email: e.target.value })} />
          </Field>

          <Field label="Phone">
            <input className={inputClass} value={p.phone ?? ''} onChange={(e) => onChange({ phone: e.target.value })} />
          </Field>

          <Field label="Address">
            <textarea className={inputClass} rows={2} value={p.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!p.showNewsletter} onChange={(e) => onChange({ showNewsletter: e.target.checked })} />
            Show newsletter signup
          </label>

          {p.showNewsletter && (
            <>
              <Field label="Newsletter heading">
                <input className={inputClass} value={p.newsletterTitle ?? ''} onChange={(e) => onChange({ newsletterTitle: e.target.value })} />
              </Field>
              <Field label="Email placeholder">
                <input className={inputClass} value={p.newsletterPlaceholder ?? ''} onChange={(e) => onChange({ newsletterPlaceholder: e.target.value })} />
              </Field>
            </>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Link columns</span>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                onClick={() =>
                  onChange({
                    footerColumns: [...(p.footerColumns ?? []), { title: 'New column', links: [{ label: 'Link', url: '#' }] }],
                  })
                }
              >
                <Plus className="h-3 w-3" /> Add column
              </button>
            </div>
            {(p.footerColumns ?? []).map((col, ci) => (
              <div key={ci} className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 flex gap-2">
                  <input
                    className={inputClass}
                    value={col.title}
                    onChange={(e) => updateColumn(ci, { ...col, title: e.target.value })}
                    placeholder="Column title"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => onChange({ footerColumns: p.footerColumns?.filter((_, i) => i !== ci) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {col.links.map((link, li) => (
                  <div key={li} className="mb-2 flex items-center gap-2">
                    <input
                      className={inputClass}
                      value={link.label}
                      onChange={(e) => updateColumnLink(ci, li, { ...link, label: e.target.value })}
                      placeholder="Label"
                    />
                    <input
                      className={inputClass}
                      value={link.url}
                      onChange={(e) => updateColumnLink(ci, li, { ...link, url: e.target.value })}
                      placeholder="#contact"
                    />
                    <button
                      type="button"
                      title="Delete link"
                      className="shrink-0 rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeColumnLink(ci, li)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs text-brand-600"
                  onClick={() => updateColumn(ci, { ...col, links: [...col.links, { label: 'New link', url: '#' }] })}
                >
                  + Add link
                </button>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Social links</span>
              <button
                type="button"
                className="text-xs font-medium text-brand-600"
                onClick={() => onChange({ socialLinks: [...(p.socialLinks ?? []), { platform: 'Facebook', url: '#' }] })}
              >
                + Add
              </button>
            </div>
            {(p.socialLinks ?? []).map((s, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input
                  className={inputClass}
                  value={s.platform}
                  onChange={(e) => updateSocial(i, { ...s, platform: e.target.value })}
                  placeholder="Platform"
                />
                <input
                  className={inputClass}
                  value={s.url}
                  onChange={(e) => updateSocial(i, { ...s, url: e.target.value })}
                  placeholder="URL"
                />
                <button
                  type="button"
                  title="Delete social link"
                  className="shrink-0 rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => onChange({ socialLinks: p.socialLinks?.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <Field label="Copyright line">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Legal links</span>
          <button
            type="button"
            className="text-xs font-medium text-brand-600"
            onClick={() => onChange({ legalLinks: [...(p.legalLinks ?? []), { label: 'New link', url: '#' }] })}
          >
            + Add
          </button>
        </div>
        {(p.legalLinks ?? []).map((link, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input
              className={inputClass}
              value={link.label}
              onChange={(e) => updateLegal(i, { ...link, label: e.target.value })}
              placeholder="Label"
            />
            <input
              className={inputClass}
              value={link.url}
              onChange={(e) => updateLegal(i, { ...link, url: e.target.value })}
              placeholder="URL"
            />
            <button
              type="button"
              title="Delete legal link"
              className="shrink-0 rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
              onClick={() => onChange({ legalLinks: p.legalLinks?.filter((_, j) => j !== i) })}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
