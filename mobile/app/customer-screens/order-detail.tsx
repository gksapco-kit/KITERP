import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { storeApi } from '../../api/store'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { Order } from '../../types'

const steps = ['pending', 'confirmed', 'shipped', 'delivered']

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) storeApi.getOrder(id).then(setOrder).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>
  if (!order) return <Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Order not found</Text>

  const currentStep = steps.indexOf(order.status)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Status */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{order.order_number}</Text>
          <Text style={{ color: '#6b7280', marginBottom: 16 }}>{formatDate(order.created_at)}</Text>
          {order.status === 'cancelled' ? (
            <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: '#ef4444', fontWeight: '600' }}>Cancelled</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {steps.map((s, i) => (
                <View key={s} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: i <= currentStep ? '#2563eb' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}>
                    {i <= currentStep && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 10, marginTop: 4, textTransform: 'capitalize', color: i <= currentStep ? '#2563eb' : '#9ca3af' }}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Items */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '600', marginBottom: 12 }}>Items</Text>
          {order.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < order.items.length - 1 ? 1 : 0, borderColor: '#f3f4f6' }}>
              <View><Text style={{ fontWeight: '500' }}>{item.name}</Text><Text style={{ fontSize: 12, color: '#6b7280' }}>Qty: {item.qty}</Text></View>
              <Text style={{ fontWeight: '600' }}>{formatCurrency(item.price * item.qty)}</Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderColor: '#e5e7eb', marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>Total</Text>
            <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{formatCurrency(order.total)}</Text>
          </View>
        </View>

        {/* Shipping */}
        {order.shipping_address && (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>Shipping Address</Text>
            <Text style={{ color: '#4b5563' }}>{order.shipping_address.street_address}</Text>
            <Text style={{ color: '#4b5563' }}>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
