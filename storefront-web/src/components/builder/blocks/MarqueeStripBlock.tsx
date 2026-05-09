import type { StyleConfig } from '@/blocks/registry'

interface Props {
  style: StyleConfig
  props: Record<string, unknown>
}

/** Matches vendor builder + Fashion template browser — uses `.sf-marquee-track` from globals.css */
export default function MarqueeStripBlock({ style, props }: Props) {
  const raw = (props.items as unknown) ?? (props.text as unknown) ?? ''
  const items = Array.isArray(raw)
    ? (raw as unknown[]).map(x => String(x).trim()).filter(Boolean)
    : String(raw)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

  return (
    <div
      className="overflow-hidden border-b py-4"
      style={{ borderColor: `${style.text_color}18`, backgroundColor: style.bg_color }}
    >
      <div className="sf-marquee-track whitespace-nowrap" style={{ fontFamily: style.font_heading }}>
        {items.length === 0 ? (
          <span className="text-sm opacity-60 px-4"> </span>
        ) : (
          Array.from({ length: 2 }).map((_, dup) => (
            <span key={dup} className="inline-flex items-center gap-10 mr-10 text-sm opacity-80">
              {items.map((item, j) => (
                <span key={`${dup}-${j}`} className="inline-flex items-center gap-4">
                  <span>{item}</span>
                  {j < items.length - 1 ? <span className="opacity-40">·</span> : null}
                </span>
              ))}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
