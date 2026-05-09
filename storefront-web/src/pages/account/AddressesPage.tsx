import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { AddressBook } from '@/kit/account/AccountBlocks'
import type { Address } from '@/kit/types'
import { ChevronRight } from 'lucide-react'

export default function AddressesPage() {
  const { customer } = useAuthStore()
  const { storePath } = useVendor()

  // Map project addresses to kit Address shape
  const kitAddresses: Address[] = (customer?.shipping_addresses || []).map((a, i) => ({
    id: String(i),
    label: a.label,
    fullName: customer?.full_name ?? '',
    line1: a.street_address ?? '',
    city: a.city ?? '',
    state: a.state ?? undefined,
    postalCode: a.postal_code ?? '',
    country: a.country ?? 'India',
    isDefault: i === (customer?.default_address_index ?? 0),
  }))

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Saved Addresses</span>
      </nav>

      <h1 className="text-2xl font-bold mb-8">Saved Addresses</h1>
      <AddressBook addresses={kitAddresses} />
    </div>
  )
}
