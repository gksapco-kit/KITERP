import { clampIntervalSeconds } from '../../lib/sectionSlider'
import type { LogoItem } from '../../types/builder'

interface LogosMarqueeProps {
  items: LogoItem[]
  intervalSeconds?: number
  renderCell: (item: LogoItem, index: number) => React.ReactNode
}

export function LogosMarquee({ items, intervalSeconds, renderCell }: LogosMarqueeProps) {
  if (items.length === 0) return null

  const duration = Math.max(items.length * clampIntervalSeconds(intervalSeconds), 8)
  const loop = [...items, ...items]

  return (
    <div className="relative overflow-hidden py-1">
      <div
        className="flex w-max items-center gap-6 md:gap-8"
        style={{
          animation: `logos-marquee ${duration}s linear infinite`,
        }}
      >
        {loop.map((item, i) => (
          <div key={`${item.id ?? i}-${i}`} className="shrink-0">
            {renderCell(item, i % items.length)}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes logos-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
