import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../../api/store'
import { formatApiFailure } from '../../../api/client'
import { formatCurrency } from '../../../lib/utils'
import { isSrMarketingStore, loadVendorBranding } from '../../../utils/vendorConfig'
import { BRAND } from '../../../utils/theme'
import { useAuthStore } from '../../../stores/authStore'

export type RentalAsset = {
  id: string
  name?: string
  title?: string
  category?: string
  asset_type?: string
  description?: string
  capacity_max?: number
  capacity_unit?: string
  available_capacity?: number
  current_occupancy?: number
  max_weight?: number | null
  weight_unit?: string
  daily_rate?: number
  weekly_rate?: number
  monthly_rate?: number
  deposit_amount?: number
  location?: string
  status?: string
  display_start_date?: string | null
  display_end_date?: string | null
  image_url?: string
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function prettyLabel(v?: string | null) {
  return (v || '').replace(/_/g, ' ').trim()
}

function statusColor(status?: string) {
  if (status === 'available') return { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' }
  if (status === 'partially_occupied') return { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' }
  return { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' }
}

function availabilityLabel(a: RentalAsset) {
  if (a.display_start_date || a.display_end_date) {
    const start = a.display_start_date ? String(a.display_start_date).slice(0, 10) : '…'
    const end = a.display_end_date ? String(a.display_end_date).slice(0, 10) : '…'
    return `${start} → ${end}`
  }
  return 'Always available'
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function CustomerRentals() {
  const router = useRouter()
  const { isAuthenticated, vendorInfo } = useAuthStore()
  const authVendorSlug = useAuthStore((s) => s.vendorSlug)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [assets, setAssets] = useState<RentalAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [bookingId, setBookingId] = useState<string | null>(null)

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true)
    try {
      const branding = await loadVendorBranding()
      const ok = isSrMarketingStore(branding.vendorSlug || vendorInfo?.slug || authVendorSlug)
      setAllowed(ok)
      if (!ok) return
      const rows = await storeApi.listRentalAssets()
      setAssets(rows as RentalAsset[])
    } catch (e) {
      console.warn('[rentals]', formatApiFailure(e))
      setAssets([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [vendorInfo?.slug, authVendorSlug])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) => {
      const hay = [a.name, a.title, a.category, a.asset_type, a.description, a.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [assets, query])

  if (allowed === false) {
    return <Redirect href="/customer-screens/home" />
  }

  const handleBook = (asset: RentalAsset) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to book this rental.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth-screens/login') },
      ])
      return
    }

    const avail = Math.max(1, Math.floor(num(asset.available_capacity) || 1))
    const qty = Math.min(avail, Math.max(1, Math.floor(num(asset.capacity_max) || 1)))
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 7)

    Alert.alert(
      'Book rental',
      `${asset.name || 'Item'}\nQty: ${qty} ${prettyLabel(asset.capacity_unit) || 'units'}\n${isoDate(start)} → ${isoDate(end)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBookingId(asset.id)
            try {
              await storeApi.createRentalBooking({
                asset_id: asset.id,
                start_date: isoDate(start),
                end_date: isoDate(end),
                quantity: qty,
              })
              Alert.alert('Booking submitted', 'Your rental request was sent. Awaiting vendor approval.')
              void load(true)
            } catch (e) {
              Alert.alert('Booking failed', formatApiFailure(e, 'Could not create booking'))
            } finally {
              setBookingId(null)
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.kicker}>MARKETPLACE</Text>
        <Text style={styles.title}>Rentals</Text>
        <Text style={styles.sub}>
          Browse available rentals and book slots in a few taps.
        </Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={BRAND.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, location, or type…"
            placeholderTextColor={BRAND.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={BRAND.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading || allowed === null ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load(true)
              }}
              tintColor="#2563EB"
              colors={['#2563EB']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color={BRAND.textMuted} />
              <Text style={styles.emptyTitle}>
                {query.trim() ? 'No rentals match your search' : 'No rentals listed yet'}
              </Text>
              <Text style={styles.emptySub}>
                Vendor rental items sync here automatically when published.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const avail = num(item.available_capacity)
            const max = num(item.capacity_max)
            const pct = max > 0 ? Math.min(100, Math.round(((max - avail) / max) * 100)) : 0
            const tone = statusColor(item.status)
            const category = prettyLabel(item.category)
            const assetType = prettyLabel(item.asset_type)
            const daily = num(item.daily_rate)
            const deposit = num(item.deposit_amount)
            const monthly = num(item.monthly_rate)
            const busy = bookingId === item.id
            const hasWindow = Boolean(item.display_start_date || item.display_end_date)

            return (
              <View style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.name || item.title || 'Rental item'}
                      </Text>
                      <Text style={styles.cardCat} numberOfLines={1}>
                        {[category, assetType].filter(Boolean).join(' · ') || 'Rental'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                      <Text style={[styles.statusText, { color: tone.text }]}>
                        {prettyLabel(item.status) || 'available'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.availRow, hasWindow ? styles.availRowDated : null]}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={hasWindow ? '#059669' : BRAND.textMuted}
                    />
                    <Text
                      style={[styles.availText, hasWindow ? styles.availTextDated : null]}
                      numberOfLines={1}
                    >
                      {availabilityLabel(item)}
                    </Text>
                  </View>

                  {!!item.description?.trim() && (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description.trim()}
                    </Text>
                  )}

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="cube-outline" size={13} color="#2563EB" />
                      <Text style={styles.metaValue}>
                        {avail}/{max}
                      </Text>
                      <Text style={styles.metaUnit}>{item.capacity_unit || 'units'}</Text>
                    </View>
                    {item.max_weight != null && (
                      <View style={styles.metaItem}>
                        <Ionicons name="scale-outline" size={13} color="#2563EB" />
                        <Text style={styles.metaValue}>
                          {item.max_weight}
                          {item.weight_unit || 'kg'}
                        </Text>
                      </View>
                    )}
                    {!!item.location && (
                      <View style={[styles.metaItem, { flexShrink: 1 }]}>
                        <Ionicons name="location-outline" size={13} color="#2563EB" />
                        <Text style={styles.metaValue} numberOfLines={1}>
                          {item.location}
                        </Text>
                      </View>
                    )}
                    <View style={styles.usageWrap}>
                      <View style={styles.usageTrack}>
                        <View
                          style={[
                            styles.usageFill,
                            {
                              width: `${pct}%`,
                              backgroundColor:
                                pct >= 100 ? '#F43F5E' : pct > 60 ? '#F59E0B' : '#2563EB',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.usagePct}>{pct}%</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {daily > 0 ? (
                      <Text style={styles.price}>
                        {formatCurrency(daily)}
                        <Text style={styles.priceUnit}>/day</Text>
                      </Text>
                    ) : deposit > 0 ? (
                      <Text style={styles.price}>{formatCurrency(deposit)}</Text>
                    ) : (
                      <Text style={styles.priceMuted}>Ask for price</Text>
                    )}
                    <Text style={styles.priceSub} numberOfLines={1}>
                      {monthly > 0 ? `${formatCurrency(monthly)}/mo · ` : ''}
                      Deposit {formatCurrency(deposit)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.bookBtn, { opacity: busy ? 0.7 : 1 }]}
                    onPress={() => handleBook(item)}
                    disabled={busy}
                    activeOpacity={0.9}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.bookText}>Book</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1,
  },
  title: { marginTop: 4, fontSize: 26, fontWeight: '800', color: BRAND.text },
  sub: { marginTop: 6, fontSize: 13, lineHeight: 18, color: BRAND.textMuted },
  searchBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: BRAND.text, paddingVertical: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: 'hidden',
  },
  cardAccent: {
    height: 3,
    backgroundColor: '#2563EB',
  },
  cardBody: { padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text },
  cardCat: { marginTop: 2, fontSize: 11, color: BRAND.textMuted, textTransform: 'capitalize' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  availRowDated: { backgroundColor: '#ECFDF5' },
  availText: { flex: 1, fontSize: 12, fontWeight: '600', color: BRAND.textMuted },
  availTextDated: { color: '#065F46' },
  cardDesc: { fontSize: 12, color: BRAND.textMuted, lineHeight: 16 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaValue: { fontSize: 11, fontWeight: '700', color: BRAND.text },
  metaUnit: { fontSize: 11, color: BRAND.textMuted },
  usageWrap: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  usageTrack: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  usageFill: { height: '100%', borderRadius: 999 },
  usagePct: { fontSize: 11, color: BRAND.textMuted, fontWeight: '600' },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  price: { fontSize: 16, fontWeight: '800', color: BRAND.text },
  priceUnit: { fontSize: 11, fontWeight: '600', color: BRAND.textMuted },
  priceMuted: { fontSize: 13, fontWeight: '700', color: BRAND.textMuted },
  priceSub: { marginTop: 2, fontSize: 10, color: BRAND.textMuted },
  bookBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    minHeight: 36,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: BRAND.text },
  emptySub: { fontSize: 13, color: BRAND.textMuted, textAlign: 'center', paddingHorizontal: 24 },
})
