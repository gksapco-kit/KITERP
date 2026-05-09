import { vendorApi } from '@/api/vendor'
import { MasterDataPicker, type PickerOption } from './MasterDataPicker'
import type { BankInfo } from './StaffPicker'

export interface CustomerPickerValue {
  id: string
  full_name: string
  phone?: string
  email?: string
  bank?: BankInfo
}

interface Props {
  selected: CustomerPickerValue | null
  onSelect: (val: CustomerPickerValue | null) => void
  disabled?: boolean
}

function buildSub(phone?: string | null, email?: string | null): string | undefined {
  const parts = [phone, email].filter(Boolean)
  return parts.length ? parts.join(' • ') : undefined
}

export function CustomerPicker({ selected, onSelect, disabled }: Props) {
  const toOption = (v: CustomerPickerValue): PickerOption => ({
    id: v.id,
    label: v.full_name,
    sub: buildSub(v.phone, v.email),
    phone: v.phone,
    email: v.email,
  })

  const handleSearch = async (q: string): Promise<PickerOption[]> => {
    const data = await vendorApi.listCustomers({ search: q, size: 20 })
    const items = data?.items || []
    return items.map(c => ({
      id: c.id,
      label: c.full_name,
      sub: buildSub(c.phone, c.email),
      phone: c.phone ?? undefined,
      email: c.email ?? undefined,
      meta: c,
    }))
  }

  const handleSelect = (opt: PickerOption | null) => {
    if (!opt) { onSelect(null); return }
    type CustomerMeta = {
      bank_name?: string; account_number?: string
      account_holder_name?: string; account_type?: string; ifsc_code?: string
    }
    const c = (opt.meta as CustomerMeta | undefined)
    onSelect({
      id: opt.id,
      full_name: opt.label,
      phone: opt.phone,
      email: opt.email,
      bank: c ? {
        bank_name: c.bank_name,
        account_number: c.account_number,
        account_holder_name: c.account_holder_name,
        account_type: c.account_type,
        ifsc_code: c.ifsc_code,
      } : undefined,
    })
  }

  return (
    <MasterDataPicker
      placeholder="Search customers by name, email or phone…"
      selected={selected ? toOption(selected) : null}
      onSearch={handleSearch}
      onSelect={handleSelect}
      disabled={disabled}
    />
  )
}
