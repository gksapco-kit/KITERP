import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function CouponBannerBlock({ style, props }: Props) {
  const [copied, setCopied] = useState(false)
  const title = (props.title as string) || 'Use code SAVE10 for 10% off!'
  const code = (props.code as string | null) || null
  const showCopy = props.show_copy_button !== false && code
  const copy = () => { if (code) { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) } }
  return (
    <div className="text-white py-3 px-4 text-center flex items-center justify-center gap-3" style={{ backgroundColor: style.accent_color || '#f59e0b' }}>
      <span className="font-semibold text-sm">{title}</span>
      {showCopy && (
        <button onClick={copy} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold transition-colors">
          {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />{code}</>}
        </button>
      )}
    </div>
  )
}
