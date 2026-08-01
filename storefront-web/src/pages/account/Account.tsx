import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useCustomerLogout } from '@/hooks/useStore'
import { Package, User, MapPin, ChevronRight, Heart, Settings, ShoppingBag, CalendarDays, Bell, Repeat, MessageSquareQuote, PackageOpen, Truck, LogOut } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'

export default function Account() {
  const { customer } = useAuthStore()
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const logout = useCustomerLogout()

  const handleLogout = () => {
    logout()
    navigate(storePath('/login'))
  }

  const menuItems = [
    { to: storePath('/account/notifications'), icon: Bell, label: 'Notifications', desc: 'Order updates and alerts', color: 'bg-sky-50 text-sky-600' },
    { to: storePath('/account/orders'), icon: Package, label: 'Your Orders', desc: 'Track, return, or buy again', color: 'bg-blue-50 text-blue-600' },
    { to: storePath('/account/bookings'), icon: CalendarDays, label: 'Your Bookings', desc: 'View service appointments', color: 'bg-indigo-50 text-indigo-600' },
    { to: storePath('/account/wishlist'), icon: Heart, label: 'Wishlist', desc: 'Saved products you love', color: 'bg-rose-50 text-rose-600' },
    { to: storePath('/account/subscriptions'), icon: Repeat, label: 'Subscriptions', desc: 'Manage recurring orders', color: 'bg-violet-50 text-violet-600' },
    { to: storePath('/account/marketplace'), icon: MessageSquareQuote, label: 'Marketplace', desc: 'Post requirements & compare quotes', color: 'bg-orange-50 text-orange-600' },
    { to: storePath('/rentals'), icon: PackageOpen, label: 'Rent Storage', desc: 'Find racks and book capacity', color: 'bg-teal-50 text-teal-600' },
    { to: storePath('/account/rentals'), icon: Truck, label: 'My Rentals', desc: 'Track bookings, payments & delivery vans', color: 'bg-cyan-50 text-cyan-600' },
    { to: storePath('/account/addresses'), icon: MapPin, label: 'Saved Addresses', desc: 'Manage delivery addresses', color: 'bg-green-50 text-green-600' },
    { to: storePath('/account/profile'), icon: Settings, label: 'Profile & Settings', desc: 'Edit profile, password, notifications', color: 'bg-accent text-primary' },
    { to: storePath('/cart'), icon: ShoppingBag, label: 'Your Cart', desc: 'View items in your cart', color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <span className="text-gray-900 font-medium">Your Account</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">Your Account</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {customer?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{customer?.full_name}</h2>
              {customer?.email && <p className="text-sm text-gray-500 truncate">{customer.email}</p>}
              {customer?.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
        <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{customer?.total_orders || 0}</p>
            <p className="text-xs text-gray-500">Total Orders</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{customer?.shipping_addresses?.length || 0}</p>
            <p className="text-xs text-gray-500">Addresses</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-2xl font-bold text-gray-900">
              {new Date(customer?.created_at || '').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-gray-500">Member Since</p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link key={item.to} to={item.to}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition-all flex items-center gap-4 group max-h-[90vh] overflow-y-auto">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
