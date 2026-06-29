import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useSuppliers, useCreateSupplier } from '@/hooks/useVendor'
import { PO_PENDING_SUPPLIER_KEY } from '@/pages/master-data/MasterDataNew'
import { dedupeSuppliers, findExistingSupplier } from '@/lib/supplierUtils'
import { toast } from 'sonner'
import { Loader2, Plus, UserPlus, Building2, ExternalLink, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
  /** Where master-data/new returns after full supplier form (e.g. procurement/sourcing) */
  returnTo?: string
  className?: string
  /** Compact inline layout — label row matches other PR header fields */
  inline?: boolean
}

export function ProcurementSupplierField({
  value,
  onChange,
  label = 'Supplier',
  required = false,
  returnTo = 'procurement/sourcing',
  className,
  inline = false,
}: Props) {
  const navigate = useNavigate()
  const { data: suppliersData, refetch: refetchSuppliers, isLoading } = useSuppliers({ is_active: true })
  const createSupplierMut = useCreateSupplier()
  const suppliers = useMemo(
    () => dedupeSuppliers(suppliersData?.items ?? []),
    [suppliersData?.items],
  )
  const pendingConsumed = useRef(false)

  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [qsName, setQsName] = useState('')
  const [qsPhone, setQsPhone] = useState('')
  const [qsEmail, setQsEmail] = useState('')

  useEffect(() => {
    if (pendingConsumed.current) return
    try {
      const raw = sessionStorage.getItem(PO_PENDING_SUPPLIER_KEY)
      if (!raw) return
      pendingConsumed.current = true
      const parsed = JSON.parse(raw)
      sessionStorage.removeItem(PO_PENDING_SUPPLIER_KEY)
      if (parsed?.id) onChange(parsed.id)
    } catch { /* ignore */ }
  }, [onChange])

  const handleQuickCreate = async () => {
    if (!qsName.trim()) return

    const existing = findExistingSupplier(suppliers, {
      name: qsName,
      phone: qsPhone || undefined,
      email: qsEmail || undefined,
    })
    if (existing) {
      onChange(existing.id)
      setShowQuickSupplier(false)
      setQsName('')
      setQsPhone('')
      setQsEmail('')
      toast.info(`"${existing.name}" already exists — selected existing supplier`)
      return
    }

    try {
      const created = await createSupplierMut.mutateAsync({
        name: qsName.trim(),
        phone: qsPhone || undefined,
        email: qsEmail || undefined,
      })
      await refetchSuppliers()
      onChange(created.id)
      setShowQuickSupplier(false)
      setQsName('')
      setQsPhone('')
      setQsEmail('')
    } catch { /* handled by hook */ }
  }

  const returnPath = returnTo.startsWith('/') ? returnTo : `/${returnTo}`
  const labelClass = inline ? 'text-[11px] leading-tight text-gray-500' : 'text-xs'
  const selectClass = inline ? 'mt-0.5 h-7 text-xs py-0 px-2' : 'mt-1'

  return (
    <div className={className}>
      <div className={`flex items-center gap-2 ${inline ? 'min-h-[16px]' : 'justify-between'}`}>
        <Label className={labelClass}>{label}{required ? ' *' : ''}</Label>
        <button
          type="button"
          onClick={() => setShowQuickSupplier(v => !v)}
          className={`shrink-0 flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ${inline ? 'text-[10px]' : 'text-xs'}`}
        >
          <UserPlus className={inline ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> New Supplier
        </button>
      </div>
      <Select
        value={value}
        onChange={onChange}
        options={selectOptionsWithBlank(
          'Select supplier…',
          suppliers.map(s => ({ value: s.id, label: s.name })),
        )}
        placeholder={isLoading ? 'Loading suppliers…' : 'Select supplier…'}
        disabled={isLoading}
        className={selectClass}
        aria-label={label}
      />
      {!isLoading && suppliers.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">
          No suppliers yet — use New Supplier or open Master Data to add one.
        </p>
      )}

      {showQuickSupplier && (
        <div className="border border-blue-200 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Quick Create Supplier
            </p>
            <button type="button" aria-label="Close" onClick={() => setShowQuickSupplier(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <Input
            className="h-8 text-sm bg-white dark:bg-gray-900"
            placeholder="Supplier name *"
            value={qsName}
            onChange={e => setQsName(e.target.value)}
          />
          <PhoneInput value={qsPhone} onChange={setQsPhone} defaultCountryIso="IN" />
          <Input
            className="h-8 text-sm bg-white dark:bg-gray-900"
            placeholder="Email (optional)"
            value={qsEmail}
            onChange={e => setQsEmail(e.target.value)}
          />
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={() => navigate(`/master-data/new?returnTo=${encodeURIComponent(returnPath.slice(1))}&kind=supplier`)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Full Details
            </button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!qsName.trim() || createSupplierMut.isPending}
              onClick={handleQuickCreate}
            >
              {createSupplierMut.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Plus className="w-3 h-3" />}
              Create & Select
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
