import { useState, useEffect, useRef } from 'react'
import { Search, X, UserCheck } from 'lucide-react'
import { useSearchPayees } from '@/hooks/useCommission'
import type { CommissionPayee } from '@/types/commission'

interface PayeeSelectorProps {
  value?: string | null          // payee_id
  payeeName?: string             // display hint
  onChange: (payee: CommissionPayee | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function PayeeSelector({
  value,
  payeeName,
  onChange,
  placeholder = 'Search earner (name / phone / ID)…',
  disabled = false,
  className = '',
}: PayeeSelectorProps) {
  const [query, setQuery] = useState(payeeName || '')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CommissionPayee | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const { data: results = [], isFetching } = useSearchPayees(query.length >= 1 ? query : '')

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync display when external value changes
  useEffect(() => {
    if (!value) {
      setSelected(null)
      setQuery('')
    }
  }, [value])

  const handleSelect = (payee: CommissionPayee) => {
    setSelected(payee)
    setQuery(payee.display_name)
    setOpen(false)
    onChange(payee)
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    onChange(null)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setOpen(true)
    if (!e.target.value) {
      setSelected(null)
      onChange(null)
    }
  }

  const linkTypeBadge: Record<string, string> = {
    vendor_user: 'Staff',
    supplier: 'Supplier',
    customer: 'Customer',
    external: 'External',
    agent: 'Agent',
    contractor: 'Contractor',
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => query.length >= 1 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
        />
        {(selected || query) && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 1 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isFetching ? (
            <div className="p-3 text-sm text-gray-400 text-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-gray-400 text-center">No earners found</div>
          ) : (
            results.map(payee => (
              <button
                key={payee.id}
                type="button"
                onMouseDown={() => handleSelect(payee)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left"
              >
                <UserCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{payee.display_name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    {payee.phone && <span>{payee.phone}</span>}
                    {payee.external_user_id && <span>#{payee.external_user_id}</span>}
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                      {linkTypeBadge[payee.link_type] || payee.link_type}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
