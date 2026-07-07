import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { storeApi } from '@/api/store'
import { AddressBook } from '@/kit/account/AccountBlocks'
import type { Address } from '@/kit/types'
import type { Address as BackendAddress } from '@/types'
import { ChevronRight } from 'lucide-react'
import { extractApiError } from '@/lib/errorMessages'

/** kit `Address` (UI shape) <-> backend `Address` (persisted shape) mapping. */
function toKitAddress(a: BackendAddress, i: number, defaultIndex: number, fallbackName: string): Address {
  return {
    id: String(i),
    label: a.label,
    fullName: a.full_name || fallbackName,
    line1: a.street_address ?? '',
    line2: a.line2 ?? undefined,
    city: a.city ?? '',
    state: a.state ?? undefined,
    postalCode: a.postal_code ?? '',
    country: a.country ?? 'India',
    phone: a.phone ?? undefined,
    isDefault: i === defaultIndex,
  }
}

function toBackendAddress(a: Address): BackendAddress {
  return {
    street_address: a.line1,
    line2: a.line2 || undefined,
    city: a.city,
    state: a.state || '',
    postal_code: a.postalCode,
    country: a.country || 'India',
    label: a.label || 'home',
    full_name: a.fullName || undefined,
    phone: a.phone || undefined,
  }
}

export default function AddressesPage() {
  const { customer, setCustomer } = useAuthStore()
  const { storePath } = useVendor()

  const backendAddresses: BackendAddress[] = customer?.shipping_addresses || []
  const defaultIndex = customer?.default_address_index ?? 0
  const kitAddresses: Address[] = backendAddresses.map((a, i) =>
    toKitAddress(a, i, defaultIndex, customer?.full_name ?? ''),
  )

  const persist = async (nextAddresses: BackendAddress[], nextDefaultIndex: number) => {
    try {
      const saved = await storeApi.updateMe({
        shipping_addresses: nextAddresses,
        default_address_index: nextDefaultIndex,
      })
      setCustomer(saved)
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save address'))
      throw err
    }
  }

  const handleAdd = async (a: Address) => {
    const next = [...backendAddresses, toBackendAddress(a)]
    await persist(next, next.length === 1 ? 0 : defaultIndex)
    toast.success('Address added')
  }

  const handleUpdate = async (a: Address) => {
    const idx = Number(a.id)
    const next = backendAddresses.map((existing, i) => (i === idx ? toBackendAddress(a) : existing))
    await persist(next, defaultIndex)
    toast.success('Address updated')
  }

  const handleDelete = async (id: string) => {
    const idx = Number(id)
    const next = backendAddresses.filter((_, i) => i !== idx)
    const nextDefault = idx === defaultIndex ? 0 : idx < defaultIndex ? defaultIndex - 1 : defaultIndex
    await persist(next, Math.min(nextDefault, Math.max(next.length - 1, 0)))
    toast.success('Address removed')
  }

  const handleSetDefault = async (id: string) => {
    await persist(backendAddresses, Number(id))
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Saved Addresses</span>
      </nav>

      <h1 className="text-2xl font-bold mb-8">Saved Addresses</h1>
      <AddressBook
        addresses={kitAddresses}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />
    </div>
  )
}
