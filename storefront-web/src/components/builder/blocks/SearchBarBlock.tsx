import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function SearchBarBlock({ style, props }: Props) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { storePath } = useVendor()
  const placeholder = (props.placeholder as string) || 'Search products & services...'
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (query.trim()) navigate(storePath(`/products?q=${encodeURIComponent(query.trim())}`)) }
  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': style.primary_color } as React.CSSProperties} />
        </div>
        <button type="submit" className="px-5 py-3 rounded-xl text-white font-semibold hover:opacity-90" style={{ backgroundColor: style.primary_color }}>Search</button>
      </form>
    </div>
  )
}
