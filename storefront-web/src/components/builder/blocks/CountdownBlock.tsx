import { useEffect, useState } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, new Date(targetDate).getTime() - Date.now())
      setTimeLeft({ days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000) })
    }
    calc(); const t = setInterval(calc, 1000); return () => clearInterval(t)
  }, [targetDate])
  return timeLeft
}

export default function CountdownBlock({ style, props }: Props) {
  const title = (props.title as string) || 'Launching In'
  const targetDate = (props.target_date as string) || new Date(Date.now() + 7 * 86400000).toISOString()
  const { days, hours, minutes, seconds } = useCountdown(targetDate)
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">{title}</h2>
      <div className="flex justify-center gap-4 flex-wrap">
        {[{ v: days, l: 'Days' }, { v: hours, l: 'Hours' }, { v: minutes, l: 'Minutes' }, { v: seconds, l: 'Seconds' }].map(({ v, l }) => (
          <div key={l} className="flex flex-col items-center w-24">
            <div className="text-5xl font-bold mb-1" style={{ color: style.primary_color }}>{String(v).padStart(2, '0')}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">{l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
