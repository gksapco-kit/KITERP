import { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, SafeAreaView } from 'react-native'
import { vendorApi } from '../../api/vendor'
import { formatCurrency } from '../../lib/utils'
import type { Customer } from '../../types'

export default function VendorCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    vendorApi.listCustomers({ page: 1, size: 50 })
      .then((data) => setCustomers(data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList data={customers} keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No customers yet</Text>}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <Text style={{ fontWeight: '600', fontSize: 15 }}>{item.full_name}</Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{item.email}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>{item.total_orders} orders</Text>
              <Text style={{ fontSize: 12, fontWeight: '600' }}>Spent: {formatCurrency(item.total_spent)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}
