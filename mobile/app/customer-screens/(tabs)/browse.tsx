import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../../api/store'
import { apiErrorMessage } from '../../../api/auth'
import { useAuthStore } from '../../../stores/authStore'
import { useCartStore } from '../../../stores/cartStore'
import { useWishlistStore } from '../../../stores/wishlistStore'
import { formatCurrency } from '../../../lib/utils'
import { productImageUrl } from '../../../lib/mediaUrl'
import { formatProductPriceLabel, getProductPricing } from '../../../lib/productPricing'
import { ProductAddToCart } from '../../../components/ProductAddToCart'
import { SrProductCard } from '../../../components/SrProductCard'
import { isSrMarketingStore, loadVendorBranding } from '../../../utils/vendorConfig'
import { BRAND } from '../../../utils/theme'
import type { Product } from '../../../types'

const { width } = Dimensions.get('window')
const CARD_GAP = 10
const H_PAD = 16
const CARD_WIDTH = (width - H_PAD * 2 - CARD_GAP) / 2

function BrowseWishButton({ product }: { product: Product }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const wishlisted = useWishlistStore((s) => s.has(product.id))
  const toggleWishlist = useWishlistStore((s) => s.toggleProduct)
  const [busy, setBusy] = useState(false)

  const onPress = async () => {
    if (!isAuthenticated) {
      router.push({
        pathname: '/auth-screens/login',
        params: { returnTo: 'wishlist' },
      })
      return
    }
    setBusy(true)
    try {
      await toggleWishlist(product, true)
    } catch (err: any) {
      Alert.alert('Wishlist', apiErrorMessage(err, 'Could not update wishlist'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <TouchableOpacity
      style={styles.wishBtn}
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#EF4444" />
      ) : (
        <Ionicons
          name={wishlisted ? 'heart' : 'heart-outline'}
          size={18}
          color={wishlisted ? '#EF4444' : '#111827'}
        />
      )}
    </TouchableOpacity>
  )
}

export default function BrowseProducts() {
  const router = useRouter()
  const { isAuthenticated, vendorInfo } = useAuthStore()
  const authVendorSlug = useAuthStore((s) => s.vendorSlug)
  const loadCart = useCartStore((s) => s.loadCart)
  const loadWishlist = useWishlistStore((s) => s.load)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [srStore, setSrStore] = useState(
    isSrMarketingStore(vendorInfo?.slug || authVendorSlug),
  )

  const fetchProducts = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const branding = await loadVendorBranding()
      setSrStore(isSrMarketingStore(branding.vendorSlug || vendorInfo?.slug || authVendorSlug))
      const data = await storeApi.listProducts({ page: 1, size: 80 })
      setProducts(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [vendorInfo?.slug, authVendorSlug])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  useFocusEffect(
    useCallback(() => {
      void loadCart(isAuthenticated).catch(() => undefined)
      if (isAuthenticated) void loadWishlist(true).catch(() => undefined)
    }, [isAuthenticated, loadCart, loadWishlist]),
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    )
  }, [products, search])

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.sub}>{filtered.length} products</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={BRAND.textMuted} />
        <TextInput
          placeholder="Search products…"
          placeholderTextColor={BRAND.textMuted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: CARD_GAP, paddingHorizontal: H_PAD }}
          contentContainerStyle={{ paddingBottom: 24, gap: CARD_GAP }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void fetchProducts({ silent: true })
                void loadCart(isAuthenticated).catch(() => undefined)
              }}
              tintColor={BRAND.primary}
              colors={[BRAND.primary]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No products found</Text>
          }
          renderItem={({ item }) => {
            if (srStore) {
              return <SrProductCard product={item} width={CARD_WIDTH} />
            }
            const imageUri = productImageUrl(item)
            const pricing = getProductPricing(item)
            return (
              <View style={styles.card}>
                <View style={styles.imageWrap}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={StyleSheet.absoluteFill}
                    onPress={() =>
                      router.push({
                        pathname: '/customer-screens/product-detail',
                        params: { slug: item.slug },
                      })
                    }
                  >
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.placeholder}>
                        <Ionicons name="image-outline" size={28} color="#C5CDCA" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <BrowseWishButton product={item} />
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/customer-screens/product-detail',
                      params: { slug: item.slug },
                    })
                  }
                >
                  <View style={styles.bodyTop}>
                    <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>
                        {formatProductPriceLabel(pricing, formatCurrency)}
                      </Text>
                      {!!pricing.compareAt &&
                        pricing.compareAt > pricing.price &&
                        pricing.price > 0 && (
                          <Text style={styles.compare}>{formatCurrency(pricing.compareAt)}</Text>
                        )}
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.bodyBottom}>
                  <ProductAddToCart product={item} />
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
  header: { paddingHorizontal: H_PAD, paddingTop: 8, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: BRAND.text },
  sub: { fontSize: 13, color: BRAND.textMuted, marginTop: 2 },
  searchBox: {
    marginHorizontal: H_PAD,
    marginBottom: 14,
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: BRAND.text, paddingVertical: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', padding: 32, color: BRAND.textMuted },
  card: {
    width: CARD_WIDTH,
    backgroundColor: BRAND.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  imageWrap: {
    width: '100%',
    height: CARD_WIDTH * 0.78,
    backgroundColor: '#EEF2F0',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wishBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  bodyTop: { paddingHorizontal: 8, paddingTop: 8 },
  bodyBottom: { paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
  name: { fontSize: 12, fontWeight: '700', color: BRAND.text },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  price: { fontSize: 13, fontWeight: '800', color: BRAND.primaryDark },
  compare: {
    fontSize: 10,
    color: BRAND.textMuted,
    textDecorationLine: 'line-through',
  },
})
