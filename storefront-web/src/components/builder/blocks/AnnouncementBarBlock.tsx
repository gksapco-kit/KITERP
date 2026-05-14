import { useState } from 'react'
import { X } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function AnnouncementBarBlock({ props }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const text = (props.text as string) || ''
  const color = (props.color as string) || '#64C3A0'
  const showClose = props.show_close !== false
  if (!text) return null
  return (
    <div className="text-white text-sm py-2 px-4 text-center relative" style={{ backgroundColor: color }}>
      {text}
      {showClose && (
        <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
