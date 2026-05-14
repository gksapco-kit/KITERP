import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { vendorApi } from '../../api/vendor'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { Order } from '../../types'

const statusColor: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', shipped: '#64C3A0',
  delivered: '#10b981', cancelled: '#ef4444',
}

export default function VendorOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    vendorApi.listOrders({ page: 1, size: 50 })
      .then((data) => setOrders(data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList data={orders} keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No orders yet</Text>}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push({ pathname: '/vendor-screens/order-detail', params: { id: item.id } })}
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: '600' }}>{item.order_number}</Text>
              <View style={{ backgroundColor: (statusColor[item.status] || '#9ca3af') + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor[item.status] || '#9ca3af', textTransform: 'capitalize' }}>{item.status}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>{item.item_count} items &middot; {formatDate(item.created_at)}</Text>
              <Text style={{ fontWeight: '700' }}>{formatCurrency(item.total)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}
