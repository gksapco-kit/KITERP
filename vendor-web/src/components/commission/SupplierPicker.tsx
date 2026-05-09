import { vendorApi } from '@/api/vendor'
import { MasterDataPicker, type PickerOption } from './MasterDataPicker'
import type { BankInfo } from './StaffPicker'

export interface SupplierPickerValue {
  id: string
  name: string
  phone?: string
  email?: string
  bank?: BankInfo
}

interface Props {
  selected: SupplierPickerValue | null
  onSelect: (val: SupplierPickerValue | null) => void
  disabled?: boolean
}

function buildSub(phone?: string | null, email?: string | null): string | undefined {
  const parts = [phone, email].filter(Boolean)
  return parts.length ? parts.join(' • ') : undefined
}

export function SupplierPicker({ selected, onSelect, disabled }: Props) {
  const toOption = (v: SupplierPickerValue): PickerOption => ({
    id: v.id,
    label: v.name,
    sub: buildSub(v.phone, v.email),
    phone: v.phone,
    email: v.email,
  })

  const handleSearch = async (q: string): Promise<PickerOption[]> => {
    const data = await vendorApi.listSuppliers({ search: q, size: 20 })
    const items = data?.items || []
    return items.map(s => ({
      id: s.id,
      label: s.name,
      sub: buildSub(s.phone, s.email),
      phone: s.phone ?? undefined,
      email: s.email ?? undefined,
      meta: s,
    }))
  }

  const handleSelect = (opt: PickerOption | null) => {
    if (!opt) { onSelect(null); return }
    type SupplierMeta = {
      bank_name?: string; account_number?: string
      account_holder_name?: string; ifsc_code?: string
    }
    const s = (opt.meta as SupplierMeta | undefined)
    onSelect({
      id: opt.id,
      name: opt.label,
      phone: opt.phone,
      email: opt.email,
      bank: s ? {
        bank_name: s.bank_name,
        account_number: s.account_number,
        account_holder_name: s.account_holder_name,
        ifsc_code: s.ifsc_code,
      } : undefined,
    })
  }

  return (
    <MasterDataPicker
      placeholder="Search suppliers / contractors by name, email or phone…"
      selected={selected ? toOption(selected) : null}
      onSearch={handleSearch}
      onSelect={handleSelect}
      disabled={disabled}
    />
  )
}
