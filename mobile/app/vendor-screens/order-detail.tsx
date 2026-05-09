import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { vendorApi } from '../../api/vendor'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { Order } from '../../types'

export default function VendorOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (id) vendorApi.getOrder(id).then(setOrder).catch(console.error).finally(() => setLoading(false))
  }, [id])

  const updateStatus = async (status: string) => {
    if (!order) return
    setUpdating(true)
    try {
      const updated = await vendorApi.updateOrderStatus(order.id, { status })
      setOrder(updated)
      Alert.alert('Success', `Order ${status}`)
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>
  if (!order) return <Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Order not found</Text>

  const nextAction = order.status === 'pending' ? { label: 'Confirm', status: 'confirmed' }
    : order.status === 'confirmed' ? { label: 'Ship', status: 'shipped' }
    : order.status === 'shipped' ? { label: 'Deliver', status: 'delivered' } : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{order.order_number}</Text>
          <Text style={{ color: '#6b7280', marginBottom: 12 }}>Placed on {formatDate(order.created_at)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View><Text style={{ fontSize: 12, color: '#6b7280' }}>Status</Text><Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{order.status}</Text></View>
            <View><Text style={{ fontSize: 12, color: '#6b7280' }}>Payment</Text><Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{order.payment_method || '-'}</Text></View>
            <View><Text style={{ fontSize: 12, color: '#6b7280' }}>Total</Text><Text style={{ fontWeight: '700', color: '#2563eb' }}>{formatCurrency(order.total)}</Text></View>
          </View>
        </View>

        {nextAction && (
          <TouchableOpacity onPress={() => updateStatus(nextAction.status)} disabled={updating}
            style={{ backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16, opacity: updating ? 0.7 : 1 }}>
            {updating ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Mark as {nextAction.label}</Text>}
          </TouchableOpacity>
        )}

        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '600', marginBottom: 12 }}>Items ({order.item_count})</Text>
          {order.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < order.items.length - 1 ? 1 : 0, borderColor: '#f3f4f6' }}>
              <View><Text style={{ fontWeight: '500' }}>{item.name}</Text><Text style={{ fontSize: 12, color: '#6b7280' }}>Qty: {item.qty}</Text></View>
              <Text style={{ fontWeight: '600' }}>{formatCurrency(item.price * item.qty)}</Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#6b7280' }}>Subtotal</Text><Text>{formatCurrency(order.subtotal)}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}><Text style={{ color: '#6b7280' }}>Tax</Text><Text>{formatCurrency(order.tax_amount)}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 8 }}>
              <Text style={{ fontWeight: 'bold' }}>Total</Text><Text style={{ fontWeight: 'bold' }}>{formatCurrency(order.total)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
