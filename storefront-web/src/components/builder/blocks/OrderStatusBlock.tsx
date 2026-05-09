import { useState } from 'react'
import { Package, Search, Loader2 } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function OrderStatusBlock({ style, props }: Props) {
  const [orderNum, setOrderNum] = useState('')
  const [loading, setLoading] = useState(false)
  const title = (props.title as string) || 'Track Your Order'
  const placeholder = (props.placeholder as string) || 'Enter order number...'
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${style.primary_color}15` }}>
        <Package className="w-8 h-8" style={{ color: style.primary_color }} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 mb-6">Enter your order number to track its status.</p>
      <form onSubmit={e => { e.preventDefault(); setLoading(true); setTimeout(() => setLoading(false), 1500) }} className="flex gap-2">
        <input value={orderNum} onChange={e => setOrderNum(e.target.value)} placeholder={placeholder} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2" />
        <button type="submit" disabled={loading} className="px-5 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: style.primary_color }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </form>
    </section>
  )
}
