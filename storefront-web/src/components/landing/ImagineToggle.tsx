type Props = {
  on: boolean
  onToggle: () => void
  label?: string
}

export function ImagineToggle({ on, onToggle, label = 'Imagine without KITERP' }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="odoo-imagine-toggle group"
      aria-pressed={on}
    >
      <span className="odoo-toggle-wrap odoo-corner-highlight">
        <span className="odoo-toggle-track" data-on={on ? 'true' : 'false'} aria-hidden>
          <span className="odoo-toggle-thumb" />
        </span>
      </span>
      <span className="odoo-imagine-toggle-label">{label}</span>
    </button>
  )
}
