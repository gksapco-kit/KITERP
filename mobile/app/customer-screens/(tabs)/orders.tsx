import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../../api/store'
import { useAuthStore } from '../../../stores/authStore'
import { formatCurrency, formatDate } from '../../../lib/utils'
import { BRAND } from '../../../utils/theme'
import type { Order } from '../../../types'

const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  shipped: BRAND.primary,
  delivered: '#10b981',
  cancelled: '#ef4444',
}

function paymentLabel(order: Order) {
  const method = (order.payment_method || '').toLowerCase()
  if (method === 'upi') return 'UPI'
  if (method === 'cod') return 'COD'
  return method ? method.toUpperCase() : '—'
}

export default function CustomerOrders() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAuthenticated) {
        setOrders([])
        setLoading(false)
        return
      }
      if (!opts?.silent) setLoading(true)
      try {
        const data = await storeApi.listOrders({ page: 1, size: 50 })
        setOrders(data.items || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [isAuthenticated],
  )

  useFocusEffect(
    useCallback(() => {
      void fetchOrders()
    }, [fetchOrders]),
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void fetchOrders({ silent: true })
  }, [fetchOrders])

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={BRAND.primary} />
          <Text style={styles.emptyTitle}>Sign in to see orders</Text>
          <Text style={styles.emptySub}>
            Orders placed in this app sync with the store dashboard
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/auth-screens/login')}
          >
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My orders</Text>
        <Text style={styles.sub}>Pull down to sync with the store</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={40} color={BRAND.textMuted} />
            <Text style={styles.emptySub}>No orders yet</Text>
            <Text style={styles.hint}>Place an order — it will appear here and on the vendor sales list</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/customer-screens/order-detail',
                params: { id: item.id },
              })
            }
            style={styles.card}
          >
            <View style={styles.row}>
              <Text style={styles.orderNo}>{item.order_number}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: (statusColor[item.status] || '#9ca3af') + '22' },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: statusColor[item.status] || '#9ca3af',
                    textTransform: 'capitalize',
                  }}
                >
                  {item.status}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.payPill}>
                <Ionicons
                  name={item.payment_method === 'upi' ? 'qr-code-outline' : 'cash-outline'}
                  size={12}
                  color={BRAND.primaryDark}
                />
                <Text style={styles.payText}>{paymentLabel(item)}</Text>
                {!!item.payment_status && (
                  <Text style={styles.payStatus}>· {item.payment_status}</Text>
                )}
              </View>
              {!!item.payment_proof?.utr && (
                <Text style={styles.utr} numberOfLines={1}>
                  UTR {item.payment_proof.utr}
                </Text>
              )}
            </View>
            <View style={styles.row}>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              <Text style={styles.total}>{formatCurrency(item.total)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '800', color: BRAND.text },
  sub: { fontSize: 12, color: BRAND.textMuted, marginTop: 2, marginBottom: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: BRAND.text, marginTop: 12 },
  emptySub: { color: BRAND.textMuted, marginTop: 4, marginBottom: 8, textAlign: 'center' },
  hint: {
    color: BRAND.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontWeight: '700', color: BRAND.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  metaRow: { marginTop: 10, gap: 4 },
  payPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payText: { fontSize: 12, fontWeight: '700', color: BRAND.primaryDark },
  payStatus: { fontSize: 12, color: BRAND.textMuted, textTransform: 'capitalize' },
  utr: { fontSize: 11, color: BRAND.textMuted },
  date: { color: BRAND.textMuted, fontSize: 13, marginTop: 10 },
  total: { fontWeight: '800', color: BRAND.primaryDark, marginTop: 10 },
})
