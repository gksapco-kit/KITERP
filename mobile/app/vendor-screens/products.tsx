import { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, SafeAreaView } from 'react-native'
import { vendorApi } from '../../api/vendor'
import { formatCurrency } from '../../lib/utils'
import type { Product } from '../../types'

export default function VendorProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    vendorApi.listProducts({ page: 1, size: 50 })
      .then((data) => setProducts(data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList data={products} keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No products</Text>}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 15 }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.category || 'Uncategorized'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '700', color: '#2563eb' }}>{formatCurrency(item.price)}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Stock: {item.quantity}</Text>
              </View>
            </View>
            <View style={{
              marginTop: 8, backgroundColor: item.status === 'active' ? '#dcfce7' : '#f3f4f6',
              alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: item.status === 'active' ? '#16a34a' : '#6b7280', textTransform: 'capitalize' }}>{item.status}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}
