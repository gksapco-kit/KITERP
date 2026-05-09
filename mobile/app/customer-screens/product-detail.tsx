import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { storeApi } from '../../api/store'
import { formatCurrency } from '../../lib/utils'
import type { Product } from '../../types'

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (slug) storeApi.getProduct(slug).then(setProduct).catch(console.error).finally(() => setLoading(false))
  }, [slug])

  const addToCart = async () => {
    if (!product) return
    setAdding(true)
    try {
      await storeApi.addToCart({
        product_id: product.id, name: product.name, qty,
        price: product.price, image_url: product.images?.[0]?.url,
      })
      Alert.alert('Success', 'Added to cart!')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>
  if (!product) return <Text style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Product not found</Text>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView>
        <View style={{ width: '100%', height: 300, backgroundColor: '#f3f4f6' }}>
          {product.images?.[0] ? <Image source={{ uri: product.images[0].url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 48, color: '#d1d5db' }}>P</Text></View>}
        </View>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{product.name}</Text>
          {product.category && <Text style={{ color: '#6b7280', marginTop: 2 }}>{product.category}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#2563eb' }}>{formatCurrency(product.price)}</Text>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <Text style={{ fontSize: 16, color: '#9ca3af', textDecorationLine: 'line-through' }}>{formatCurrency(product.compare_at_price)}</Text>
            )}
          </View>
          {product.description && <Text style={{ color: '#4b5563', marginTop: 16, lineHeight: 22 }}>{product.description}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 }}>
            <Text style={{ fontWeight: '600' }}>Quantity:</Text>
            <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={{ width: 36, height: 36, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 18 }}>-</Text></TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', width: 32, textAlign: 'center' }}>{qty}</Text>
            <TouchableOpacity onPress={() => setQty(qty + 1)} style={{ width: 36, height: 36, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 18 }}>+</Text></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#e5e7eb' }}>
        <TouchableOpacity onPress={addToCart} disabled={adding}
          style={{ backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center', opacity: adding ? 0.7 : 1 }}>
          {adding ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Add to Cart - {formatCurrency(product.price * qty)}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
