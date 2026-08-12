import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiErrorMessage } from '../../api/auth'
import { storeApi } from '../../api/store'
import { useAuthStore } from '../../stores/authStore'
import { formatCurrency, formatDate } from '../../lib/utils'
import { BRAND, withAlpha } from '../../utils/theme'

type Booking = {
  id: string
  booking_number?: string
  asset_name?: string
  asset_code?: string
  asset_location?: string
  capacity_unit?: string
  capacity_max?: number
  quantity?: number
  start_date: string
  end_date: string
  status: string
  rental_amount?: number
  deposit_amount?: number
  total_amount?: number
  payment_status?: string
  delivery_status?: string
  van_number?: string
  van_driver_name?: string
  van_driver_phone?: string
  van_vehicle_type?: string
  estimated_delivery_at?: string
  delivered_at?: string
  delivery_notes?: string
  delivery_address?: string
  timeline?: Array<{ event: string; detail?: string; at?: string }>
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#d97706',
  approved: '#2563eb',
  confirmed: '#4f46e5',
  active: '#059669',
  completed: '#6b7280',
  cancelled: '#dc2626',
  rejected: '#dc2626',
  paid: '#059669',
  unpaid: '#dc2626',
  in_transit: '#0284c7',
  assigned: '#4f46e5',
  delivered: '#059669',
  pending_delivery: '#d97706',
}

function statusLabel(value?: string) {
  return (value || '—').replace(/_/g, ' ')
}

function StatusPill({ status }: { status?: string }) {
  const color = STATUS_COLOR[status || ''] || BRAND.textMuted
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Text style={[styles.pillText, { color }]}>{statusLabel(status)}</Text>
    </View>
  )
}

export default function MyRentalsScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Booking | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBookings = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAuthenticated) {
        setBookings([])
        setLoading(false)
        return
      }
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const rows = await storeApi.listMyRentalBookings()
        setBookings(rows as Booking[])
      } catch (err: any) {
        setError(apiErrorMessage(err, 'Could not load rental bookings'))
        setBookings([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [isAuthenticated],
  )

  useFocusEffect(
    useCallback(() => {
      void fetchBookings()
    }, [fetchBookings]),
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void fetchBookings({ silent: true })
  }, [fetchBookings])

  const openSelected = useCallback((b: Booking) => {
    setSelected(b)
  }, [])

  const refreshSelected = useCallback(
    async (id: string) => {
      try {
        const fresh = (await storeApi.getMyRentalBooking(id)) as Booking
        setSelected(fresh)
        setBookings((prev) => prev.map((row) => (row.id === id ? { ...row, ...fresh } : row)))
      } catch {
        void fetchBookings({ silent: true })
      }
    },
    [fetchBookings],
  )

  const onPay = useCallback(async () => {
    if (!selected) return
    setBusy(true)
    try {
      await storeApi.payRentalBooking(selected.id, {
        payment_method: 'upi',
        payment_reference: `APP-${Date.now()}`,
      })
      Alert.alert('Payment successful', 'Your rental payment was recorded.')
      await refreshSelected(selected.id)
    } catch (err: any) {
      Alert.alert('Payment failed', apiErrorMessage(err, 'Could not complete payment'))
    } finally {
      setBusy(false)
    }
  }, [refreshSelected, selected])

  const onCancel = useCallback(() => {
    if (!selected) return
    Alert.alert('Cancel rental', 'Cancel this booking?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          try {
            await storeApi.cancelRentalBooking(selected.id)
            Alert.alert('Cancelled', 'Your rental booking was cancelled.')
            await refreshSelected(selected.id)
          } catch (err: any) {
            Alert.alert('Cancel failed', apiErrorMessage(err, 'Could not cancel booking'))
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }, [refreshSelected, selected])

  const canPay = useMemo(() => {
    if (!selected) return false
    if (selected.payment_status === 'paid') return false
    return !['cancelled', 'rejected'].includes(selected.status)
  }, [selected])

  const canCancel = useMemo(
    () => !!selected && ['pending', 'approved'].includes(selected.status),
    [selected],
  )

  if (!isAuthenticated) {
    return (
      <Redirect
        href={{
          pathname: '/auth-screens/login',
          params: { returnTo: 'my-rentals' },
        }}
      />
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
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.headerSub}>Track bookings, payments & delivery</Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.push('/customer-screens/rental')}
              activeOpacity={0.85}
            >
              <Ionicons name="cube-outline" size={16} color="#fff" />
              <Text style={styles.browseBtnText}>Browse rentals</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={44} color={BRAND.primary} />
            <Text style={styles.emptyTitle}>
              {error || 'You have no rental bookings yet'}
            </Text>
            <Text style={styles.emptySub}>
              Book from Rentals, then track status here under Account.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/customer-screens/rental')}
            >
              <Text style={styles.primaryBtnText}>Browse rentals</Text>
            </TouchableOpacity>
            {!!error && (
              <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchBookings()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openSelected(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.asset_name || 'Rental asset'}
                </Text>
                {!!item.booking_number && (
                  <Text style={styles.cardMeta}>{item.booking_number}</Text>
                )}
              </View>
              <StatusPill status={item.status} />
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="calendar-outline" size={14} color={BRAND.textMuted} />
              <Text style={styles.cardMeta}>
                {formatDate(item.start_date)} → {formatDate(item.end_date)}
              </Text>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardMeta}>
                Qty {item.quantity ?? '—'}
                {item.capacity_unit ? ` ${item.capacity_unit}` : ''}
              </Text>
              <Text style={styles.amount}>{formatCurrency(Number(item.total_amount || 0))}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
        <View style={styles.sheet}>
          {selected && (
            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHandle} />
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sheetTitle}>{selected.asset_name || 'Rental'}</Text>
                  {!!selected.booking_number && (
                    <Text style={styles.cardMeta}>{selected.booking_number}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={BRAND.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.pillRow}>
                <StatusPill status={selected.status} />
                <StatusPill status={selected.payment_status || 'unpaid'} />
              </View>

              <View style={styles.detailGrid}>
                <Detail label="Rental period" value={`${formatDate(selected.start_date)} – ${formatDate(selected.end_date)}`} />
                <Detail
                  label="Quantity"
                  value={`${selected.quantity ?? '—'} / ${selected.capacity_max ?? '—'} ${selected.capacity_unit || ''}`.trim()}
                />
                <Detail label="Location" value={selected.asset_location || '—'} />
                <Detail label="Rental" value={formatCurrency(Number(selected.rental_amount || 0))} />
                <Detail label="Deposit" value={formatCurrency(Number(selected.deposit_amount || 0))} />
                <Detail label="Total" value={formatCurrency(Number(selected.total_amount || 0))} />
              </View>

              {selected.delivery_status && selected.delivery_status !== 'not_required' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Delivery</Text>
                  <StatusPill status={selected.delivery_status} />
                  {selected.van_number ? (
                    <View style={styles.deliveryBox}>
                      <Text style={styles.cardMeta}>Vehicle: {selected.van_number}</Text>
                      {!!selected.van_vehicle_type && (
                        <Text style={styles.cardMeta}>Type: {selected.van_vehicle_type}</Text>
                      )}
                      {!!selected.van_driver_name && (
                        <Text style={styles.cardMeta}>Driver: {selected.van_driver_name}</Text>
                      )}
                      {!!selected.van_driver_phone && (
                        <Text style={styles.cardMeta}>Phone: {selected.van_driver_phone}</Text>
                      )}
                      {!!selected.estimated_delivery_at && (
                        <Text style={styles.cardMeta}>
                          ETA: {new Date(selected.estimated_delivery_at).toLocaleString('en-IN')}
                        </Text>
                      )}
                      {!!selected.delivered_at && (
                        <Text style={styles.cardMeta}>
                          Delivered: {new Date(selected.delivered_at).toLocaleString('en-IN')}
                        </Text>
                      )}
                      {!!selected.delivery_notes && (
                        <Text style={styles.cardMeta}>{selected.delivery_notes}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.cardMeta, { marginTop: 8 }]}>
                      Waiting for vendor to assign delivery.
                    </Text>
                  )}
                  {!!selected.delivery_address && (
                    <Text style={[styles.cardMeta, { marginTop: 8 }]}>
                      Address: {selected.delivery_address}
                    </Text>
                  )}
                </View>
              )}

              {Array.isArray(selected.timeline) && selected.timeline.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Timeline</Text>
                  {selected.timeline.map((t, i) => (
                    <View key={`${t.event}-${i}`} style={styles.timelineRow}>
                      <View style={styles.dot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEvent}>{t.event}</Text>
                        {!!t.detail && <Text style={styles.cardMeta}>{t.detail}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.actions}>
                {canPay && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={() => void onPay()}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        Pay {formatCurrency(Number(selected.total_amount || 0))}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {canCancel && (
                  <TouchableOpacity
                    style={[styles.outlineBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={onCancel}
                  >
                    <Text style={styles.outlineBtnText}>Cancel rental</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.bg },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  headerBlock: { marginBottom: 14 },
  headerSub: { color: BRAND.textMuted, fontSize: 13, marginBottom: 12 },
  browseBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  browseBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: BRAND.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  cardMeta: { fontSize: 12, color: BRAND.textMuted, marginTop: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amount: { fontWeight: '800', color: BRAND.primaryDark, fontSize: 14 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    minWidth: 160,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  retryBtn: { marginTop: 12, padding: 8 },
  retryText: { color: BRAND.primaryDark, fontWeight: '700' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: BRAND.bg,
  },
  outlineBtnText: { color: BRAND.danger, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: BRAND.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: 'auto',
  },
  sheetBody: { padding: 18, paddingBottom: 36 },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: BRAND.text },
  detailGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    width: '47%',
    backgroundColor: BRAND.bg,
    borderRadius: 12,
    padding: 10,
  },
  detailLabel: { fontSize: 11, color: BRAND.textMuted, fontWeight: '600' },
  detailValue: { marginTop: 4, fontSize: 13, color: BRAND.text, fontWeight: '700' },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: BRAND.text, marginBottom: 8 },
  deliveryBox: {
    marginTop: 8,
    backgroundColor: BRAND.bg,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.primary,
    marginTop: 5,
  },
  timelineEvent: { fontSize: 13, fontWeight: '700', color: BRAND.text },
  actions: { marginTop: 20, gap: 10 },
})
