import { Link } from 'react-router-dom'
import { Calendar, Package, Wrench } from 'lucide-react'

export default function RentalHubPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rentals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Run equipment or space rentals using bookings (pickup/return windows) and catalog items as rental SKUs.
          A dedicated rental engine can extend this later with deposits and asset schedules.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/bookings" className="rounded-xl border bg-white p-5 shadow-sm hover:border-primary/40 transition-colors flex gap-3">
          <Calendar className="w-10 h-10 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">Bookings</p>
            <p className="text-xs text-gray-500 mt-1">Schedule rental periods; note pickup and return in booking notes.</p>
          </div>
        </Link>
        <Link to="/services/new" className="rounded-xl border bg-white p-5 shadow-sm hover:border-primary/40 transition-colors flex gap-3">
          <Wrench className="w-10 h-10 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">Rental service SKU</p>
            <p className="text-xs text-gray-500 mt-1">Create a service titled “Equipment rental” with duration-based pricing.</p>
          </div>
        </Link>
        <Link to="/products/new" className="rounded-xl border bg-white p-5 shadow-sm hover:border-primary/40 transition-colors flex gap-3">
          <Package className="w-10 h-10 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">Rental product SKU</p>
            <p className="text-xs text-gray-500 mt-1">Track serialized units or deposits as inventory-backed rentals.</p>
          </div>
        </Link>
        <Link to="/orders" className="rounded-xl border bg-white p-5 shadow-sm hover:border-primary/40 transition-colors flex gap-3">
          <Package className="w-10 h-10 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">Orders</p>
            <p className="text-xs text-gray-500 mt-1">Online rental checkout flows through storefront orders.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
