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
      className="kiterp-imagine-toggle group"
      aria-pressed={on}
    >
      <span className="kiterp-toggle-wrap kiterp-corner-highlight">
        <span className="kiterp-toggle-track" data-on={on ? 'true' : 'false'} aria-hidden>
          <span className="kiterp-toggle-thumb" />
        </span>
      </span>
      <span className="kiterp-imagine-toggle-label">{label}</span>
    </button>
  )
}
