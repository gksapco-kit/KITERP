import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { storeApi } from '../../api/store'
import { formatCurrency, formatDate } from '../../lib/utils'
import { BRAND } from '../../utils/theme'
import type { Order } from '../../types'

const steps = ['pending', 'confirmed', 'shipped', 'delivered']

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      storeApi.getOrder(id).then(setOrder).catch(console.error).finally(() => setLoading(false))
    }
  }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    )
  }
  if (!order) {
    return <Text style={styles.notFound}>Order not found</Text>
  }

  const currentStep = steps.indexOf(order.status)

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.orderNo}>{order.order_number}</Text>
          <Text style={styles.date}>{formatDate(order.created_at)}</Text>
          {order.status === 'cancelled' ? (
            <View style={styles.cancelled}>
              <Text style={{ color: BRAND.danger, fontWeight: '700' }}>Cancelled</Text>
            </View>
          ) : (
            <View style={styles.steps}>
              {steps.map((s, i) => (
                <View key={s} style={{ alignItems: 'center', flex: 1 }}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: i <= currentStep ? BRAND.primary : BRAND.border },
                    ]}
                  >
                    {i <= currentStep && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      textTransform: 'capitalize',
                      color: i <= currentStep ? BRAND.primary : BRAND.textMuted,
                      fontWeight: '600',
                    }}
                  >
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Items</Text>
          {order.items.map((item, i) => (
            <View
              key={i}
              style={[
                styles.itemRow,
                i < order.items.length - 1 && { borderBottomWidth: 1, borderColor: '#f3f4f6' },
              ]}
            >
              <View>
                <Text style={{ fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: BRAND.textMuted }}>Qty: {item.qty}</Text>
              </View>
              <Text style={{ fontWeight: '700' }}>{formatCurrency(item.price * item.qty)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={{ fontWeight: '800' }}>Total</Text>
            <Text style={{ fontWeight: '800', color: BRAND.primaryDark }}>
              {formatCurrency(order.total)}
            </Text>
          </View>
        </View>

        {order.shipping_address && (
          <View style={styles.card}>
            <Text style={styles.section}>Shipping address</Text>
            <Text style={{ color: '#4b5563' }}>{order.shipping_address.street_address}</Text>
            <Text style={{ color: '#4b5563' }}>
              {order.shipping_address.city}, {order.shipping_address.state}{' '}
              {order.shipping_address.postal_code}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { textAlign: 'center', padding: 32, color: BRAND.textMuted },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  orderNo: { fontSize: 20, fontWeight: '800', color: BRAND.text, marginBottom: 4 },
  date: { color: BRAND.textMuted, marginBottom: 16 },
  cancelled: { backgroundColor: BRAND.dangerSoft, padding: 12, borderRadius: 10 },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { fontWeight: '700', marginBottom: 12, color: BRAND.text },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalRow: {
    borderTopWidth: 1,
    borderColor: BRAND.border,
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
