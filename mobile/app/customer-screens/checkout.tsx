import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { storeApi } from '../../api/store'
import { BRAND } from '../../utils/theme'

export default function CheckoutScreen() {
  const router = useRouter()
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    if (!street || !city || !state || !postalCode) {
      return Alert.alert('Error', 'Fill in all fields')
    }
    setLoading(true)
    try {
      const order = await storeApi.checkout({
        shipping_address: {
          street_address: street,
          city,
          state,
          postal_code: postalCode,
          country: 'India',
        },
        payment_method: paymentMethod,
      })
      Alert.alert('Order placed!', `Order ${order.order_number} placed.`, [
        {
          text: 'View',
          onPress: () =>
            router.replace({
              pathname: '/customer-screens/order-detail',
              params: { id: order.id },
            }),
        },
      ])
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.detail || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const methods = [
    { value: 'cod', label: 'Cash on Delivery' },
    { value: 'upi', label: 'UPI' },
    { value: 'card', label: 'Card' },
  ]

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.section}>Shipping address</Text>
        <TextInput
          placeholder="Street Address"
          value={street}
          onChangeText={setStreet}
          style={styles.input}
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextInput
            placeholder="City"
            value={city}
            onChangeText={setCity}
            style={[styles.input, { flex: 1 }]}
          />
          <TextInput
            placeholder="State"
            value={state}
            onChangeText={setState}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
        <TextInput
          placeholder="Postal Code"
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={[styles.section, { marginTop: 8 }]}>Payment method</Text>
        {methods.map((m) => {
          const active = paymentMethod === m.value
          return (
            <TouchableOpacity
              key={m.value}
              onPress={() => setPaymentMethod(m.value)}
              style={[styles.method, active && styles.methodActive]}
            >
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.methodLabel}>{m.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleCheckout}
          disabled={loading}
          style={[styles.cta, { opacity: loading ? 0.7 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.ctaText}>Place order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.card },
  section: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: BRAND.text },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    marginBottom: 8,
  },
  methodActive: { borderColor: BRAND.primary, backgroundColor: BRAND.primarySoft },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: BRAND.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.primary },
  methodLabel: { fontWeight: '600', color: BRAND.text },
  footer: { padding: 16, borderTopWidth: 1, borderColor: BRAND.border },
  cta: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: { color: 'white', fontWeight: '800', fontSize: 16 },
})
