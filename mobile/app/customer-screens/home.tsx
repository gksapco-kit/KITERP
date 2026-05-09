import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Image, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { storeApi } from '../../api/store'
import { useAuthStore } from '../../stores/authStore'
import { formatCurrency } from '../../lib/utils'
import type { Product } from '../../types'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - 48) / 2

export default function CustomerHome() {
  const router = useRouter()
  const { customer, vendorInfo, logout } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    storeApi.listProducts({ page: 1, size: 10 })
      .then((data) => setProducts(data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const navItems = [
    { label: 'Browse', route: '/customer-screens/browse', emoji: 'S' },
    { label: 'Cart', route: '/customer-screens/cart', emoji: 'C' },
    { label: 'Orders', route: '/customer-screens/orders', emoji: 'O' },
    { label: 'Account', route: '/customer-screens/account', emoji: 'A' },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {vendorInfo && (
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '600' }}>{vendorInfo.display_name}</Text>
          </View>
        )}
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Hello, {customer?.full_name}!</Text>
        <Text style={{ color: '#6b7280', marginBottom: 24 }}>What are you looking for today?</Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          {navItems.map((item) => (
            <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)}
              style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{item.emoji}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Featured Products</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ paddingVertical: 32 }} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {products.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => router.push({ pathname: '/customer-screens/product-detail', params: { slug: p.slug } })}
                style={{ width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                <View style={{ width: '100%', height: CARD_WIDTH, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0].url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: '#d1d5db', fontSize: 32 }}>P</Text>
                  )}
                </View>
                <View style={{ padding: 10 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '500', fontSize: 13 }}>{p.name}</Text>
                  <Text style={{ fontWeight: '700', color: '#2563eb', marginTop: 2 }}>{formatCurrency(p.price)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={() => { logout(); router.replace('/auth-screens/login') }}
          style={{ backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 32 }}>
          <Text style={{ color: '#ef4444', fontWeight: '600' }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
