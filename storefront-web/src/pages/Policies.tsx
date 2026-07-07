import { useStoreInfo } from '@/hooks/useStore'

export default function Policies() {
  const { data: store } = useStoreInfo()

  const sections = [
    {
      title: 'Return & Refund Policy',
      content: `At ${store?.display_name || 'our store'}, we want you to be completely satisfied with your purchase. If you are not satisfied, you may return the product within 7 days of delivery for a full refund or exchange, provided the item is in its original condition and packaging.\n\nTo initiate a return, please contact our support team with your order number and reason for return. Refunds will be processed within 5-7 business days after we receive the returned item.\n\nProducts that have been used, damaged by the customer, or are missing original tags/packaging may not be eligible for return.`,
    },
    {
      title: 'Cancellation Policy',
      content: `You may cancel your order before it has been shipped. Once an order is shipped, it cannot be cancelled but may be returned after delivery as per our return policy.\n\nFor service bookings, cancellations made at least 24 hours before the scheduled appointment will receive a full refund. Cancellations made within 24 hours may be subject to a cancellation fee.\n\nTo cancel an order or booking, please visit your account page or contact our support team.`,
    },
    {
      title: 'Shipping & Delivery',
      content: `We aim to deliver your orders as quickly as possible. Standard delivery typically takes 3-5 business days depending on your location.\n\nDelivery charges may apply based on order value and delivery distance. Orders above a certain amount may qualify for free delivery.\n\nYou will receive tracking information via email/WhatsApp once your order is shipped. If you have any questions about your delivery, please contact our support team.`,
    },
    {
      title: 'Privacy Policy',
      content: `We are committed to protecting your privacy. We collect personal information (name, email, phone, address) only to process your orders and provide better service.\n\nWe do not sell, trade, or share your personal information with third parties except as required for order fulfillment (e.g., delivery partners) or legal compliance.\n\nYou can request deletion of your account and data at any time by contacting our support team.`,
    },
    {
      title: 'Terms & Conditions',
      content: `By using this store, you agree to these terms. All products and services are subject to availability. Prices are subject to change without notice.\n\nWe reserve the right to refuse service, terminate accounts, or cancel orders at our discretion.\n\nAll content on this store is the property of ${store?.display_name || 'the store owner'} and may not be reproduced without permission.`,
    },
  ]

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Store Policies</h1>

      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">{section.title}</h2>
          <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{section.content}</div>
        </div>
      ))}

      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">
          If you have any questions about our policies, please contact us at{' '}
          <span className="font-medium text-gray-700">{store?.primary_email || store?.support_email || 'our support email'}</span>
        </p>
      </div>
    </div>
  )
}
