import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { storeApi } from '../../api/store'

export default function CheckoutScreen() {
  const router = useRouter()
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    if (!street || !city || !state || !postalCode) return Alert.alert('Error', 'Fill in all fields')
    setLoading(true)
    try {
      const order = await storeApi.checkout({
        shipping_address: { street_address: street, city, state, postal_code: postalCode, country: 'India' },
        payment_method: paymentMethod,
      })
      Alert.alert('Order Placed!', `Order ${order.order_number} placed.`, [
        { text: 'View', onPress: () => router.replace({ pathname: '/customer-screens/order-detail', params: { id: order.id } }) },
      ])
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.detail || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 } as const
  const methods = [{ value: 'cod', label: 'Cash on Delivery' }, { value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' }]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Shipping Address</Text>
        <TextInput placeholder="Street Address" value={street} onChangeText={setStreet} style={inputStyle} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextInput placeholder="City" value={city} onChangeText={setCity} style={{ ...inputStyle, flex: 1 }} />
          <TextInput placeholder="State" value={state} onChangeText={setState} style={{ ...inputStyle, flex: 1 }} />
        </View>
        <TextInput placeholder="Postal Code" value={postalCode} onChangeText={setPostalCode} keyboardType="numeric" style={inputStyle} />
        <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 12 }}>Payment Method</Text>
        {methods.map((m) => (
          <TouchableOpacity key={m.value} onPress={() => setPaymentMethod(m.value)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: paymentMethod === m.value ? '#2563eb' : '#e5e7eb', borderRadius: 8, marginBottom: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: paymentMethod === m.value ? '#2563eb' : '#d1d5db', justifyContent: 'center', alignItems: 'center' }}>
              {paymentMethod === m.value && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' }} />}
            </View>
            <Text style={{ fontWeight: '500' }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#e5e7eb' }}>
        <TouchableOpacity onPress={handleCheckout} disabled={loading}
          style={{ backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center', opacity: loading ? 0.7 : 1 }}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Place Order</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
