import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { CreditCard, MapPin, Truck } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function CheckoutFormBlock({ style, props }: Props) {
  const { storePath } = useVendor()
  // Real checkout is at the /checkout shell route — this block is a CTA/info card for builder pages
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Secure Checkout</h2>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: MapPin, title: 'Step 1', desc: 'Delivery Address' },
          { icon: Truck, title: 'Step 2', desc: 'Shipping Method' },
          { icon: CreditCard, title: 'Step 3', desc: 'Payment' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${style.primary_color}15` }}>
              <Icon className="w-5 h-5" style={{ color: style.primary_color }} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{title}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <Link to={storePath('/cart')} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold hover:opacity-90 transition-all" style={{ backgroundColor: style.primary_color }}>
          <CreditCard className="w-5 h-5" />
          Proceed to Checkout
        </Link>
        {!!props.allow_cod && (
          <p className="text-xs text-gray-400 mt-3">Cash on Delivery available</p>
        )}
      </div>
    </section>
  )
}
