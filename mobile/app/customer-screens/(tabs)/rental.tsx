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
  Modal,
  Pressable,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
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

/** Local calendar YYYY-MM-DD (avoid UTC shift from toISOString). */
function localIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalYmd(s?: string | null): Date | null {
  const raw = String(s || '').slice(0, 10)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function addDaysLocal(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

function todayLocal() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Catalog "available" ignores pending/date holds. Prefer a 7-day free window
 * (same as website default range); fall back to a 1-day slot.
 */
async function findNextFreeSlot(
  asset: RentalAsset,
  quantity: number,
  horizonDays = 45,
): Promise<{ start: string; end: string; free: number } | null> {
  const winStart = parseLocalYmd(asset.display_start_date)
  const winEnd = parseLocalYmd(asset.display_end_date)
  let cursor = todayLocal()
  if (winStart && winStart > cursor) cursor = winStart

  const tryRange = async (startDay: Date, endDay: Date) => {
    if (winEnd && endDay > winEnd) return null
    if (winEnd && startDay > winEnd) return null
    const start = localIsoDate(startDay)
    const end = localIsoDate(endDay)
    const rows = await storeApi.searchAvailableRentals({
      quantity,
      start_date: start,
      end_date: end,
    })
    const hit = rows.find((r) => String(r?.id) === String(asset.id))
    if (!hit) return null
    const free = Math.floor(num(hit.available_capacity ?? hit.capacity_max))
    if (free < quantity) return null
    return { start, end, free }
  }

  // Prefer website-like 7-day window first
  for (let i = 0; i < horizonDays; i++) {
    const startDay = addDaysLocal(cursor, i)
    try {
      const week = await tryRange(startDay, addDaysLocal(startDay, 6))
      if (week) return week
    } catch {
      /* continue */
    }
  }

  // Fall back to single free day
  for (let i = 0; i < horizonDays; i++) {
    const startDay = addDaysLocal(cursor, i)
    try {
      const day = await tryRange(startDay, startDay)
      if (day) return day
    } catch {
      /* continue */
    }
  }
  return null
}

function estimateTotal(
  asset: RentalAsset,
  start: string,
  end: string,
  plan: string,
) {
  if (!start || !end) {
    return {
      rental: 0,
      deposit: num(asset.deposit_amount),
      total: num(asset.deposit_amount),
      days: 0,
    }
  }
  const s = parseLocalYmd(start)
  const e = parseLocalYmd(end)
  if (!s || !e || e < s) {
    return {
      rental: 0,
      deposit: num(asset.deposit_amount),
      total: num(asset.deposit_amount),
      days: 0,
    }
  }
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  let rental = 0
  if (plan === 'monthly' && num(asset.monthly_rate) > 0) {
    rental = num(asset.monthly_rate) * Math.max(1, Math.ceil(days / 30))
  } else if (plan === 'weekly' && num(asset.weekly_rate) > 0) {
    rental = num(asset.weekly_rate) * Math.max(1, Math.ceil(days / 7))
  } else {
    rental = num(asset.daily_rate) * days
  }
  const deposit = num(asset.deposit_amount)
  return { rental, deposit, total: rental + deposit, days }
}

type PricingPlan = 'daily' | 'weekly' | 'monthly'

type BookDraft = {
  asset: RentalAsset
  qty: string
  startDate: string
  endDate: string
  pricingPlan: PricingPlan
  notes: string
  needsDelivery: boolean
  deliveryAddress: string
  free: number
  checking: boolean
}

export default function CustomerRentals() {
  const router = useRouter()
  const { isAuthenticated, vendorInfo, customer } = useAuthStore()
  const authVendorSlug = useAuthStore((s) => s.vendorSlug)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [assets, setAssets] = useState<RentalAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BookDraft | null>(null)

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

  const openBookSheet = async (asset: RentalAsset) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to book this rental.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign in',
          onPress: () =>
            router.push({
              pathname: '/auth-screens/login',
              params: { returnTo: 'rentals' },
            }),
        },
      ])
      return
    }

    setDraft({
      asset,
      qty: '1',
      startDate: localIsoDate(todayLocal()),
      endDate: localIsoDate(todayLocal()),
      pricingPlan: 'daily',
      notes: '',
      needsDelivery: false,
      deliveryAddress: '',
      free: 0,
      checking: true,
    })
    setBookingId(asset.id)

    try {
      // Pull latest name/rates/capacity from vendor (no rebuild required).
      let fresh = asset
      try {
        const latest = await storeApi.getRentalAsset(asset.id)
        if (latest && typeof latest === 'object') {
          fresh = { ...asset, ...latest } as RentalAsset
          setAssets((prev) =>
            prev.map((row) => (String(row.id) === String(asset.id) ? { ...row, ...latest } : row)),
          )
        }
      } catch {
        /* keep list snapshot */
      }

      const slot = await findNextFreeSlot(fresh, 1)
      if (!slot) {
        setDraft(null)
        Alert.alert(
          'No free dates',
          'This rental is fully reserved for the coming weeks (including pending requests). Try again later or pick another item.',
        )
        return
      }
      setDraft({
        asset: fresh,
        qty: '1',
        startDate: slot.start,
        endDate: slot.end,
        pricingPlan: 'daily',
        notes: '',
        needsDelivery: false,
        deliveryAddress: '',
        free: slot.free,
        checking: false,
      })
    } catch (e) {
      setDraft(null)
      Alert.alert('Booking', formatApiFailure(e, 'Could not check availability'))
    } finally {
      setBookingId(null)
    }
  }

  const patchDraft = (patch: Partial<BookDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const confirmBook = async () => {
    if (!draft) return
    const qty = Math.max(1, Math.floor(Number(draft.qty) || 1))
    if (qty > draft.free) {
      Alert.alert(
        'Not enough capacity',
        `Only ${draft.free} ${prettyLabel(draft.asset.capacity_unit) || 'units'} free on those dates.`,
      )
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.endDate)) {
      Alert.alert('Invalid dates', 'Use YYYY-MM-DD for start and end dates.')
      return
    }
    if (draft.endDate < draft.startDate) {
      Alert.alert('Invalid dates', 'End date must be on or after start date.')
      return
    }
    if (draft.needsDelivery && !draft.deliveryAddress.trim()) {
      Alert.alert('Delivery address', 'Please enter a delivery address.')
      return
    }

    setBookingId(draft.asset.id)
    try {
      const rows = await storeApi.searchAvailableRentals({
        quantity: qty,
        start_date: draft.startDate,
        end_date: draft.endDate,
      })
      const hit = rows.find((r) => String(r?.id) === String(draft.asset.id))
      if (!hit) {
        const slot = await findNextFreeSlot(draft.asset, qty)
        if (slot) {
          patchDraft({
            startDate: slot.start,
            endDate: slot.end,
            free: slot.free,
            checking: false,
          })
          Alert.alert(
            'Dates unavailable',
            `Those dates are full. Next free day is ${slot.start} (${slot.free} free). Confirm again to book that day.`,
          )
        } else {
          Alert.alert('Dates unavailable', 'No free capacity found for the next several weeks.')
        }
        return
      }

      const freeNow = Math.floor(num(hit.available_capacity ?? hit.capacity_max))
      if (qty > freeNow) {
        Alert.alert(
          'Not enough capacity',
          `Only ${freeNow} ${prettyLabel(draft.asset.capacity_unit) || 'units'} free on those dates.`,
        )
        patchDraft({ free: freeNow })
        return
      }

      await storeApi.createRentalBooking({
        asset_id: draft.asset.id,
        start_date: draft.startDate,
        end_date: draft.endDate,
        quantity: qty,
        pricing_plan: draft.pricingPlan,
        notes: draft.notes.trim() || undefined,
        needs_delivery: draft.needsDelivery,
        delivery_address: draft.needsDelivery ? draft.deliveryAddress.trim() : undefined,
      })
      setDraft(null)
      Alert.alert('Booking submitted', 'Your rental request was sent. Awaiting vendor approval.')
      void load(true)
    } catch (e) {
      Alert.alert('Booking failed', formatApiFailure(e, 'Could not create booking'))
    } finally {
      setBookingId(null)
    }
  }

  const unit = prettyLabel(draft?.asset.capacity_unit) || 'units'
  const busyConfirm = bookingId === draft?.asset.id
  const priceEstimate = draft
    ? estimateTotal(draft.asset, draft.startDate, draft.endDate, draft.pricingPlan)
    : null
  const planOptions: PricingPlan[] = ['daily', 'weekly', 'monthly']
  const { height: windowHeight } = useWindowDimensions()

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.kicker}>MARKETPLACE</Text>
        <Text style={styles.title}>Rentals</Text>
        <Text style={styles.sub}>
          Live from vendor — new rentals, names, and prices sync automatically. Pull down to refresh.
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
            const avail =
              item.available_capacity == null
                ? num(item.capacity_max)
                : num(item.available_capacity)
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
            const canBook = avail >= 1 && item.status !== 'fully_occupied'

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
                    style={[
                      styles.bookBtn,
                      { opacity: busy || !canBook ? 0.55 : 1 },
                      !canBook ? styles.bookBtnDisabled : null,
                    ]}
                    onPress={() => void openBookSheet(item)}
                    disabled={busy || !canBook}
                    activeOpacity={0.9}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.bookText}>{canBook ? 'Book' : 'Full'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
        />
      )}

      <Modal
        visible={!!draft}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setDraft(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDraft(null)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.sheetWrap,
              { maxHeight: Math.min(windowHeight * 0.88, windowHeight - 56) },
            ]}
          >
            <View style={styles.sheet}>
              {draft && (
                <>
                  <View style={styles.sheetGrabArea}>
                    <View style={styles.sheetHandle} />
                  </View>

                  <ScrollView
                    contentContainerStyle={styles.sheetBody}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    <TouchableOpacity
                      style={styles.backLink}
                      onPress={() => setDraft(null)}
                      hitSlop={8}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.backLinkText}>← Back to rentals</Text>
                    </TouchableOpacity>

                    <Text style={styles.newBookingKicker}>NEW BOOKING</Text>
                    <Text style={styles.sheetTitle} numberOfLines={2}>
                      {draft.asset.name || 'Rental item'}
                    </Text>

                    <View style={styles.availBanner}>
                      <View style={styles.availBannerIcon}>
                        <Ionicons name="calendar-outline" size={18} color="#059669" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.availBannerLabel}>AVAILABLE DATES</Text>
                        <Text style={styles.availBannerValue}>{availabilityLabel(draft.asset)}</Text>
                      </View>
                    </View>

                    {draft.checking ? (
                      <View style={styles.checkingBox}>
                        <ActivityIndicator color="#2563EB" />
                        <Text style={styles.checkingText}>Finding next free date…</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.fieldLabel}>Quantity ({unit})</Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={draft.qty}
                          onChangeText={(qty) => patchDraft({ qty })}
                          keyboardType="number-pad"
                          placeholder="1"
                          placeholderTextColor="#9CA3AF"
                        />

                        <Text style={styles.fieldLabel}>Pricing plan</Text>
                        <View style={styles.planRow}>
                          {planOptions.map((plan) => {
                            const active = draft.pricingPlan === plan
                            return (
                              <TouchableOpacity
                                key={plan}
                                style={[styles.planChip, active && styles.planChipActive]}
                                onPress={() => patchDraft({ pricingPlan: plan })}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.planChipText, active && styles.planChipTextActive]}>
                                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>

                        <View style={styles.dateRow}>
                          <View style={styles.dateCol}>
                            <Text style={styles.fieldLabel}>Start date</Text>
                            <TextInput
                              style={styles.fieldInput}
                              value={draft.startDate}
                              onChangeText={(startDate) => patchDraft({ startDate })}
                              autoCapitalize="none"
                              autoCorrect={false}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                          <View style={styles.dateCol}>
                            <Text style={styles.fieldLabel}>End date</Text>
                            <TextInput
                              style={styles.fieldInput}
                              value={draft.endDate}
                              onChangeText={(endDate) => patchDraft({ endDate })}
                              autoCapitalize="none"
                              autoCorrect={false}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                        </View>

                        <Text style={styles.fieldLabel}>Notes (optional)</Text>
                        <TextInput
                          style={[styles.fieldInput, styles.notesInput]}
                          value={draft.notes}
                          onChangeText={(notes) => patchDraft({ notes })}
                          placeholder="Any special request…"
                          placeholderTextColor="#9CA3AF"
                          multiline
                          textAlignVertical="top"
                        />

                        <View style={styles.deliveryRow}>
                          <Text style={styles.deliveryLabel}>Need delivery van</Text>
                          <Switch
                            value={draft.needsDelivery}
                            onValueChange={(needsDelivery) => patchDraft({ needsDelivery })}
                            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                            thumbColor={draft.needsDelivery ? '#2563EB' : '#f4f4f5'}
                            ios_backgroundColor="#D1D5DB"
                          />
                        </View>

                        {draft.needsDelivery ? (
                          <>
                            <Text style={styles.fieldLabel}>Delivery address</Text>
                            <TextInput
                              style={styles.fieldInput}
                              value={draft.deliveryAddress}
                              onChangeText={(deliveryAddress) => patchDraft({ deliveryAddress })}
                              placeholder="Delivery address"
                              placeholderTextColor="#9CA3AF"
                            />
                          </>
                        ) : null}

                        <Text style={styles.estimatedTotal}>
                          Estimated total:{' '}
                          <Text style={styles.estimatedTotalValue}>
                            {formatCurrency(priceEstimate?.total || 0)}
                          </Text>
                        </Text>

                        <Text style={styles.bookingAs}>
                          Booking as {customer?.full_name || customer?.email || 'Customer'}
                        </Text>

                        <TouchableOpacity
                          style={[styles.primaryBtn, busyConfirm && { opacity: 0.7 }]}
                          disabled={busyConfirm || !draft.startDate || !draft.endDate}
                          onPress={() => void confirmBook()}
                          activeOpacity={0.9}
                        >
                          {busyConfirm ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryBtnText}>Confirm Booking Request</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  bookBtnDisabled: { backgroundColor: '#94A3B8' },
  bookText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: BRAND.text },
  emptySub: { fontSize: 13, color: BRAND.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetWrap: {
    width: '100%',
    zIndex: 2,
  },
  sheet: {
    maxHeight: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: '#E8ECF1',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.2,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 16 },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
      },
    }),
  },
  sheetGrabArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  backLinkText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
  newBookingKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.4,
  },
  sheetTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  availBanner: {
    marginTop: 14,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  availBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 1.1,
  },
  availBannerValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#064E3B',
  },
  checkingBox: {
    marginTop: 36,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 36,
  },
  checkingText: { color: '#6B7280', fontWeight: '600' },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    minHeight: 46,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  planRow: { flexDirection: 'row', gap: 8 },
  planChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  planChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  planChipText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  planChipTextActive: { color: '#FFFFFF' },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateCol: { flex: 1 },
  deliveryRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deliveryLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  estimatedTotal: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  estimatedTotalValue: {
    color: '#111827',
    fontWeight: '800',
  },
  bookingAs: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
