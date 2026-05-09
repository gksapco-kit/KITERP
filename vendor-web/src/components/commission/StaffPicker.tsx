import { vendorApi } from '@/api/vendor'
import { MasterDataPicker, type PickerOption } from './MasterDataPicker'

export interface BankInfo {
  bank_name?: string
  account_number?: string
  account_holder_name?: string
  account_type?: string
  ifsc_code?: string
}

export interface StaffPickerValue {
  id: string           // TeamMember.id (the membership row id)
  user_id: string
  full_name: string
  phone?: string
  email?: string
  bank?: BankInfo
}

interface Props {
  selected: StaffPickerValue | null
  onSelect: (val: StaffPickerValue | null) => void
  disabled?: boolean
}

function buildSub(phone?: string | null, email?: string | null): string | undefined {
  const parts = [phone, email].filter(Boolean)
  return parts.length ? parts.join(' • ') : undefined
}

export function StaffPicker({ selected, onSelect, disabled }: Props) {
  const toOption = (v: StaffPickerValue): PickerOption => ({
    id: v.id,
    label: v.full_name,
    sub: buildSub(v.phone, v.email),
    phone: v.phone,
    email: v.email,
  })

  const handleSearch = async (q: string): Promise<PickerOption[]> => {
    const data = await vendorApi.listTeamMembers({ search: q, size: 20 })
    const items = data?.items || []
    return items.map(m => ({
      id: m.id,
      label: m.user?.full_name || m.role_name || m.id,
      sub: buildSub(m.user?.phone, m.user?.email),
      phone: m.user?.phone ?? undefined,
      email: m.user?.email ?? undefined,
      meta: m,
    }))
  }

  const handleSelect = async (opt: PickerOption | null) => {
    if (!opt) { onSelect(null); return }
    try {
      const m = await vendorApi.getTeamMember(opt.id)
      onSelect({
        id: m.id,
        user_id: m.user_id,
        full_name: m.user?.full_name || m.role_name || opt.label,
        phone: m.user?.phone ?? opt.phone,
        email: m.user?.email ?? opt.email,
      })
    } catch {
      onSelect({
        id: opt.id,
        user_id: '',
        full_name: opt.label,
        phone: opt.phone,
        email: opt.email,
      })
    }
  }

  return (
    <MasterDataPicker
      placeholder="Search staff by name, email or phone…"
      selected={selected ? toOption(selected) : null}
      onSearch={handleSearch}
      onSelect={handleSelect}
      disabled={disabled}
    />
  )
}
