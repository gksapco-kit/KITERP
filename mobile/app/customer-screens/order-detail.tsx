import { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../api/store'
import { formatCurrency, formatDate } from '../../lib/utils'
import { BRAND } from '../../utils/theme'
import type { Order } from '../../types'

const steps = ['pending', 'confirmed', 'shipped', 'delivered']

function prettyStatus(value?: string | null) {
  if (!value) return '—'
  return value.replace(/_/g, ' ').trim()
}

function methodLabel(method: string) {
  if (method === 'upi') return 'UPI'
  if (method === 'cod') return 'Cash on Delivery'
  if (!method) return 'Not specified'
  return method.toUpperCase()
}

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrder = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return
      if (!opts?.silent) setLoading(true)
      try {
        const data = await storeApi.getOrder(id)
        setOrder(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id],
  )

  useFocusEffect(
    useCallback(() => {
      void fetchOrder()
    }, [fetchOrder]),
  )

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    )
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Order not found</Text>
      </View>
    )
  }

  const currentStep = steps.indexOf(order.status)
  const method = (order.payment_method || '').toLowerCase()
  const paid = (order.payment_status || '').toLowerCase() === 'paid'

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.screenFill}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void fetchOrder({ silent: true })
              }}
              tintColor={BRAND.primary}
              colors={[BRAND.primary]}
            />
          }
        >
          <View style={styles.card}>
            <Text style={styles.orderNo}>{order.order_number}</Text>
            <Text style={styles.date}>{formatDate(order.created_at)}</Text>
            <Text style={styles.syncHint}>Pull down to sync status from the store</Text>
            {order.status === 'cancelled' ? (
              <View style={styles.cancelled}>
                <Text style={{ color: BRAND.danger, fontWeight: '700' }}>Cancelled</Text>
              </View>
            ) : (
              <View style={styles.steps}>
                {steps.map((s, i) => (
                  <View key={s} style={styles.stepItem}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: i <= currentStep ? BRAND.primary : BRAND.border },
                      ]}
                    >
                      {i <= currentStep ? (
                        <Text style={styles.dotCheck}>✓</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        { color: i <= currentStep ? BRAND.primary : BRAND.textMuted },
                      ]}
                    >
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Payment details</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment method</Text>
              <View style={styles.methodChip}>
                <Ionicons
                  name={method === 'upi' ? 'qr-code-outline' : 'cash-outline'}
                  size={16}
                  color={BRAND.primaryDark}
                />
                <Text style={styles.methodChipText}>{methodLabel(method)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment status</Text>
              <Text style={[styles.infoValue, paid && styles.infoValueOk]}>
                {prettyStatus(order.payment_status)}
              </Text>
            </View>

            {!!order.payment_proof?.utr && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>UTR / Transaction ID</Text>
                <Text style={styles.infoValueMono} selectable>
                  {order.payment_proof.utr}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Items</Text>
            {order.items.map((item, i) => (
              <View
                key={`${item.name}-${i}`}
                style={[
                  styles.itemRow,
                  i < order.items.length - 1 && styles.itemRowBorder,
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  {formatCurrency(item.price * item.qty)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>

          {order.shipping_address ? (
            <View style={styles.card}>
              <Text style={styles.section}>Shipping address</Text>
              <Text style={styles.addressLine}>{order.shipping_address.street_address}</Text>
              <Text style={styles.addressLine}>
                {order.shipping_address.city}, {order.shipping_address.state}{' '}
                {order.shipping_address.postal_code}
              </Text>
              {!!order.shipping_address.phone && (
                <Text style={styles.addressLine}>Phone: {order.shipping_address.phone}</Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  screenFill: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scroll: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: BRAND.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.bg,
  },
  notFound: { textAlign: 'center', padding: 32, color: BRAND.textMuted },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  orderNo: { fontSize: 20, fontWeight: '800', color: BRAND.text, marginBottom: 4 },
  date: { color: BRAND.textMuted, marginBottom: 6 },
  syncHint: { fontSize: 11, color: BRAND.textMuted, marginBottom: 14 },
  cancelled: { backgroundColor: BRAND.dangerSoft, padding: 12, borderRadius: 10 },
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel: {
    fontSize: 10,
    marginTop: 4,
    textTransform: 'capitalize',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: { fontWeight: '800', marginBottom: 14, color: BRAND.text, fontSize: 16 },
  infoRow: {
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.textMuted,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.text,
    textTransform: 'capitalize',
    lineHeight: 22,
  },
  infoValueMono: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.text,
    lineHeight: 22,
  },
  infoValueOk: { color: BRAND.primaryDark },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BRAND.primarySoft,
    borderWidth: 1,
    borderColor: BRAND.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  methodChipText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
    flexShrink: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemName: { fontWeight: '600', color: BRAND.text },
  itemQty: { fontSize: 12, color: BRAND.textMuted, marginTop: 2 },
  itemPrice: { fontWeight: '700', color: BRAND.text },
  totalRow: {
    borderTopWidth: 1,
    borderColor: BRAND.border,
    marginTop: 8,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: { fontWeight: '800', color: BRAND.text },
  totalValue: { fontWeight: '800', color: BRAND.primaryDark },
  addressLine: { color: '#4B5563', lineHeight: 20 },
})
