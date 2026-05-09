import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { storeApi } from '../../api/store'
import { formatCurrency } from '../../lib/utils'
import type { Product } from '../../types'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - 48) / 2

export default function BrowseProducts() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    storeApi.listProducts({ page: 1, size: 50 })
      .then((data) => setProducts(data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList data={products} keyExtractor={(item) => item.id} numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No products found</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push({ pathname: '/customer-screens/product-detail', params: { slug: item.slug } })}
            style={{ width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
            <View style={{ width: '100%', height: CARD_WIDTH, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
              {item.images?.[0] ? <Image source={{ uri: item.images[0].url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 32, color: '#d1d5db' }}>P</Text>}
            </View>
            <View style={{ padding: 10 }}>
              <Text numberOfLines={1} style={{ fontWeight: '500', fontSize: 13 }}>{item.name}</Text>
              <Text style={{ fontWeight: '700', color: '#2563eb', marginTop: 2 }}>{formatCurrency(item.price)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}
