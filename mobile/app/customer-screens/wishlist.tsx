import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native'
import { Redirect, useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiErrorMessage } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'
import { useWishlistStore, type WishlistItem } from '../../stores/wishlistStore'
import { formatCurrency } from '../../lib/utils'
import { mediaUrl } from '../../lib/mediaUrl'
import { BRAND } from '../../utils/theme'

export default function WishlistScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const items = useWishlistStore((s) => s.items)
  const loading = useWishlistStore((s) => s.loading)
  const loadWishlist = useWishlistStore((s) => s.load)
  const removeProduct = useWishlistStore((s) => s.removeProduct)
  const [refreshing, setRefreshing] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) void loadWishlist(true).catch(() => undefined)
    }, [isAuthenticated, loadWishlist]),
  )

  if (!isAuthenticated) {
    return (
      <Redirect
        href={{
          pathname: '/auth-screens/login',
          params: { returnTo: 'wishlist' },
        }}
      />
    )
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      if (isAuthenticated) await loadWishlist(true)
    } finally {
      setRefreshing(false)
    }
  }

  const openProduct = (item: WishlistItem) => {
    if (!item.slug) {
      Alert.alert('Unavailable', 'This product can no longer be opened.')
      return
    }
    router.push({
      pathname: '/customer-screens/product-detail',
      params: { slug: item.slug },
    })
  }

  const onRemove = async (item: WishlistItem) => {
    setRemovingId(item.product_id)
    try {
      await removeProduct(item.product_id, isAuthenticated)
    } catch (err: any) {
      Alert.alert('Wishlist', apiErrorMessage(err, 'Could not remove item'))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.product_id}
          contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND.primary}
              colors={[BRAND.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="heart-outline" size={32} color={BRAND.primaryDark} />
              </View>
              <Text style={styles.emptyTitle}>No wishlist items yet</Text>
              <Text style={styles.emptySub}>
                Tap the heart on any product to save it here.
              </Text>
              <TouchableOpacity
                style={styles.shopBtn}
                onPress={() => router.push('/customer-screens/browse')}
                activeOpacity={0.9}
              >
                <Text style={styles.shopBtnText}>Browse products</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const thumb = mediaUrl(item.image_url)
            const busy = removingId === item.product_id
            return (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.rowMain}
                  activeOpacity={0.85}
                  onPress={() => openProduct(item)}
                >
                  <View style={styles.thumb}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <Ionicons name="image-outline" size={22} color={BRAND.textMuted} />
                    )}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.price}>
                      {item.price > 0 ? formatCurrency(item.price) : 'Price on request'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => onRemove(item)}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityLabel="Remove from wishlist"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Ionicons name="heart" size={20} color="#EF4444" />
                  )}
                </TouchableOpacity>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 28, gap: 10 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  empty: { alignItems: 'center' },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: BRAND.text },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: BRAND.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  shopBtn: {
    marginTop: 20,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  shopBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#EEF2F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  price: { marginTop: 4, fontSize: 14, fontWeight: '800', color: BRAND.primaryDark },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
