import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Alert,
  RefreshControl,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { resolveVendorBySlug } from '../../../api/client'
import { useAuthStore } from '../../../stores/authStore'
import { useCartStore } from '../../../stores/cartStore'
import { formatCurrency } from '../../../lib/utils'
import { mediaUrl } from '../../../lib/mediaUrl'
import { isSignInMandatory } from '../../../lib/deliveryConditions'
import { getVendorSlug } from '../../../utils/vendorConfig'
import { BRAND } from '../../../utils/theme'
import type { CartItem } from '../../../types'

function CartLine({
  item,
  index,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem
  index: number
  onUpdateQty: (index: number, qty: number) => void
  onRemove: (index: number) => void
}) {
  const thumb = mediaUrl(item.image_url)

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <Ionicons name="leaf-outline" size={22} color={BRAND.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            onPress={() => onUpdateQty(index, Math.max(0, item.qty - 1))}
            style={styles.qtyBtn}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qty}>{item.qty}</Text>
          <TouchableOpacity
            onPress={() => onUpdateQty(index, item.qty + 1)}
            style={styles.qtyBtn}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(index)} style={{ marginLeft: 'auto' }}>
            <Text style={styles.remove}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.lineTotal}>{formatCurrency(item.price * item.qty)}</Text>
    </View>
  )
}

export default function CartScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const items = useCartStore((s) => s.items)
  const loading = useCartStore((s) => s.loading)
  const loadCart = useCartStore((s) => s.loadCart)
  const updateLineQty = useCartStore((s) => s.updateLineQty)
  const removeLine = useCartStore((s) => s.removeLine)
  // Default true to match storefront / API when settings are unknown
  const [signInMandatory, setSignInMandatory] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const syncCartAndSettings = useCallback(async () => {
    await loadCart(isAuthenticated).catch(() => undefined)
    const slug = getVendorSlug()
    if (!slug) return
    try {
      const vendor = await resolveVendorBySlug(slug)
      setSignInMandatory(isSignInMandatory(vendor.settings))
    } catch {
      setSignInMandatory(true)
    }
  }, [isAuthenticated, loadCart])

  useFocusEffect(
    useCallback(() => {
      void syncCartAndSettings()
    }, [syncCartAndSettings]),
  )

  const updateQty = async (index: number, qty: number) => {
    try {
      await updateLineQty(index, qty, isAuthenticated)
    } catch (err) {
      console.error(err)
    }
  }

  const removeItem = async (index: number) => {
    try {
      await removeLine(index, isAuthenticated)
    } catch (err) {
      console.error(err)
    }
  }

  const proceedCheckout = () => {
    if (!items.length) return
    if (!isAuthenticated && signInMandatory) {
      Alert.alert(
        'Sign in required',
        'Sign in is required to place an order at this store',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign in',
            onPress: () =>
              router.push({
                pathname: '/auth-screens/login',
                params: { returnTo: 'checkout' },
              }),
          },
        ],
      )
      return
    }
    router.push('/customer-screens/checkout')
  }

  const needsSignIn = !isAuthenticated && signInMandatory

  if (loading && isAuthenticated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    )
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cart</Text>
        <Text style={styles.sub}>
          {items.length} items{!isAuthenticated && items.length > 0 ? ' · Guest' : ''}
        </Text>
      </View>

      {!items.length ? (
        <View style={styles.center}>
          <Ionicons name="bag-handle-outline" size={48} color={BRAND.textMuted} />
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptySub}>Browse products to add items</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/customer-screens/browse')}
          >
            <Text style={styles.primaryBtnText}>Browse products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item, i) => `${item.product_id}-${item.variant_id || i}`}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true)
                  await syncCartAndSettings()
                  setRefreshing(false)
                }}
                tintColor={BRAND.primary}
                colors={[BRAND.primary]}
              />
            }
            renderItem={({ item, index }) => (
              <CartLine
                item={item}
                index={index}
                onUpdateQty={updateQty}
                onRemove={removeItem}
              />
            )}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            {needsSignIn && (
              <Text style={styles.checkoutHint}>
                Sign in is required to checkout at this store.
              </Text>
            )}
            {!isAuthenticated && !signInMandatory && (
              <Text style={styles.checkoutHint}>
                You can checkout as a guest — name and email are asked on the next screen.
              </Text>
            )}
            <TouchableOpacity style={styles.primaryBtnWide} onPress={proceedCheckout}>
              <Text style={styles.primaryBtnText}>
                {needsSignIn ? 'Sign in & checkout' : 'Proceed to checkout'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: BRAND.text },
  sub: { fontSize: 13, color: BRAND.textMuted, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: BRAND.text, marginTop: 12 },
  emptySub: { color: BRAND.textMuted, marginTop: 4, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryBtnWide: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  checkoutHint: {
    color: BRAND.textMuted,
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  row: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  itemName: { fontWeight: '700', color: BRAND.text, fontSize: 14 },
  itemPrice: { color: BRAND.textMuted, fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '600', color: BRAND.text },
  qty: { fontWeight: '700', minWidth: 20, textAlign: 'center' },
  remove: { color: BRAND.danger, fontSize: 13, fontWeight: '600' },
  lineTotal: { fontWeight: '800', color: BRAND.text, fontSize: 13 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: BRAND.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: BRAND.primaryDark },
})
