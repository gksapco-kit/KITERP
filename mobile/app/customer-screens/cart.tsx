import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { storeApi } from '../../api/store'
import { formatCurrency } from '../../lib/utils'
import type { Cart } from '../../types'

export default function CartScreen() {
  const router = useRouter()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)

  const loadCart = () => {
    storeApi.getCart().then(setCart).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadCart() }, [])

  const updateQty = async (index: number, qty: number) => {
    try {
      const updated = await storeApi.updateCartItem(index, qty)
      setCart(updated)
    } catch (err) { console.error(err) }
  }

  const removeItem = async (index: number) => {
    try {
      const updated = await storeApi.removeCartItem(index)
      setCart(updated)
    } catch (err) { console.error(err) }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  const subtotal = cart?.items?.reduce((sum, i) => sum + i.price * i.qty, 0) || 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {!cart?.items?.length ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🛒</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 4 }}>Cart is empty</Text>
          <Text style={{ color: '#6b7280' }}>Browse products to add items</Text>
          <TouchableOpacity onPress={() => router.push('/customer-screens/browse')}
            style={{ backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 16 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList data={cart.items} keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item, index }) => (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontWeight: '700' }}>{formatCurrency(item.price * item.qty)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => updateQty(index, Math.max(1, item.qty - 1))}
                      style={{ width: 28, height: 28, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                      <Text>-</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: '600' }}>{item.qty}</Text>
                    <TouchableOpacity onPress={() => updateQty(index, item.qty + 1)}
                      style={{ width: 28, height: 28, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                      <Text>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(index)}>
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>Total</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2563eb' }}>{formatCurrency(subtotal)}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/customer-screens/checkout')}
              style={{ backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}
