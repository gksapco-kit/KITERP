import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  TextInput,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi, type StoreCategory } from '../../../api/store'
import { formatApiFailure } from '../../../api/client'
import { useAuthStore } from '../../../stores/authStore'
import { formatCurrency } from '../../../lib/utils'
import { productImageUrl } from '../../../lib/mediaUrl'
import { formatProductPriceLabel, getProductPricing } from '../../../lib/productPricing'
import {
  clearBrandingCache,
  isSrMarketingStore,
  loadVendorBranding,
} from '../../../utils/vendorConfig'
import { BRAND } from '../../../utils/theme'
import { ProductAddToCart } from '../../../components/ProductAddToCart'
import { SrProductCard } from '../../../components/SrProductCard'
import { useCartStore } from '../../../stores/cartStore'
import { useWishlistStore } from '../../../stores/wishlistStore'
import type { Product } from '../../../types'

const { width } = Dimensions.get('window')
const CARD_GAP = 10
const H_PAD = 16
const CARD_WIDTH = (width - H_PAD * 2 - CARD_GAP) / 2
const SR_CARD_WIDTH = CARD_WIDTH

function flattenCategories(cats: StoreCategory[]): StoreCategory[] {
  const out: StoreCategory[] = []
  for (const c of cats) {
    out.push(c)
    if (c.children?.length) out.push(...flattenCategories(c.children))
  }
  return out
}

export default function CustomerHome() {
  const router = useRouter()
  const { customer, vendorInfo, isAuthenticated } = useAuthStore()
  const authVendorSlug = useAuthStore((s) => s.vendorSlug)
  const loadCart = useCartStore((s) => s.loadCart)
  const cartItemCount = useCartStore((s) => s.itemCount)
  const loadWishlist = useWishlistStore((s) => s.load)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [storeName, setStoreName] = useState(vendorInfo?.display_name || 'Store')
  const [srStore, setSrStore] = useState(() =>
    isSrMarketingStore(vendorInfo?.slug || authVendorSlug),
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const searchInputRef = useRef<TextInput>(null)

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearch('')
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [])

  const refreshCartCount = useCallback(async () => {
    await loadCart(isAuthenticated).catch(() => undefined)
  }, [isAuthenticated, loadCart])

  const refreshWishlist = useCallback(async () => {
    if (isAuthenticated) {
      await loadWishlist(true).catch(() => undefined)
    }
  }, [isAuthenticated, loadWishlist])

  const load = useCallback(async (opts?: { silent?: boolean; bustCache?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      if (opts?.bustCache) clearBrandingCache()
      const branding = await loadVendorBranding()
      if (branding.name) setStoreName(branding.name)
      setSrStore(isSrMarketingStore(branding.vendorSlug || vendorInfo?.slug || authVendorSlug))

      const [prodRes, cats] = await Promise.all([
        storeApi.listProducts({
          page: 1,
          size: 40,
          ...(selectedCategory ? { category: selectedCategory } : {}),
        }),
        storeApi.listCategories().catch(() => [] as StoreCategory[]),
      ])
      setProducts(prodRes.items || [])
      setCategories(flattenCategories(cats).slice(0, 12))
      setLoadError(null)
      await refreshCartCount()
      await refreshWishlist()
    } catch (e) {
      console.warn('[home]', formatApiFailure(e, 'Failed to load store'))
      setLoadError(formatApiFailure(e, 'Failed to load store'))
      setProducts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedCategory, refreshCartCount, refreshWishlist, vendorInfo?.slug, authVendorSlug])

  useEffect(() => {
    void load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      void refreshCartCount()
      void refreshWishlist()
    }, [refreshCartCount, refreshWishlist]),
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

  const greeting = customer?.full_name?.split(' ')[0] || 'there'

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load({ silent: true, bustCache: true })
            }}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
          />
        }
      >
        {/* Header — SR Marketing only: search icon beside cart; expands over store name */}
        {srStore ? (
          <View style={styles.headerRow}>
            {searchOpen ? (
              <View style={styles.headerSearchWrap}>
                <View style={styles.headerSearchBox}>
                  <Ionicons name="search-outline" size={18} color={BRAND.textMuted} />
                  <TextInput
                    ref={searchInputRef}
                    placeholder="Search milk, curd, dairy…"
                    placeholderTextColor={BRAND.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    style={styles.headerSearchInput}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {search.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={BRAND.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.searchCancelBtn} onPress={closeSearch} hitSlop={8}>
                  <Text style={styles.searchCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.headerBrand}>
                <Text style={styles.hello}>Hello, {greeting}</Text>
                <Text style={styles.srEyebrow} numberOfLines={1}>
                  {storeName}
                </Text>
              </View>
            )}

            {!searchOpen ? (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={openSearch}
                  accessibilityLabel="Search"
                >
                  <Ionicons name="search-outline" size={22} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cartBtn}
                  onPress={() => router.push('/customer-screens/cart')}
                  accessibilityLabel="Cart"
                >
                  <Ionicons name="bag-handle-outline" size={22} color={BRAND.white} />
                  {cartItemCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {cartItemCount > 9 ? '9+' : cartItemCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.cartBtnCompact}
                onPress={() => router.push('/customer-screens/cart')}
                accessibilityLabel="Cart"
              >
                <Ionicons name="bag-handle-outline" size={20} color={BRAND.white} />
                {cartItemCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {cartItemCount > 9 ? '9+' : cartItemCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.headerRow}>
            {searchOpen ? (
              <View style={styles.headerSearchWrap}>
                <View style={styles.headerSearchBox}>
                  <Ionicons name="search-outline" size={18} color={BRAND.textMuted} />
                  <TextInput
                    ref={searchInputRef}
                    placeholder="Search plants, pots, tools…"
                    placeholderTextColor={BRAND.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    style={styles.headerSearchInput}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {search.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={BRAND.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.searchCancelBtn} onPress={closeSearch} hitSlop={8}>
                  <Text style={styles.searchCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.headerBrand}>
                <Text style={styles.eyebrow}>Welcome to</Text>
                <Text style={styles.storeTitle} numberOfLines={1}>
                  {storeName}
                </Text>
                <Text style={styles.hello}>Hello, {greeting}</Text>
              </View>
            )}

            {!searchOpen ? (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={openSearch}
                  accessibilityLabel="Search"
                >
                  <Ionicons name="search-outline" size={22} color={BRAND.primaryDark} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cartBtn}
                  onPress={() => router.push('/customer-screens/cart')}
                  accessibilityLabel="Cart"
                >
                  <Ionicons name="bag-handle-outline" size={22} color={BRAND.white} />
                  {cartItemCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {cartItemCount > 9 ? '9+' : cartItemCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.cartBtnCompact}
                onPress={() => router.push('/customer-screens/cart')}
                accessibilityLabel="Cart"
              >
                <Ionicons name="bag-handle-outline" size={20} color={BRAND.white} />
                {cartItemCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {cartItemCount > 9 ? '9+' : cartItemCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Promo banner */}
        <View style={styles.banner}>
          {srStore ? (
            <>
              <Text style={styles.bannerTitle}>Dairy & rentals, made simple</Text>
              <Text style={styles.bannerSub}>
                Fresh milk and curd for every day — plus crates and storage you can rent when you need them.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.bannerTag}>FRESH & GREEN</Text>
              <Text style={styles.bannerTitle}>Root Nature Grow</Text>
              <Text style={styles.bannerSub}>
                Healthy plants, gardening essentials & expert care — for home and terrace.
              </Text>
            </>
          )}
          <TouchableOpacity
            style={[styles.bannerCta, srStore && styles.bannerCtaBlue]}
            onPress={() => router.push('/customer-screens/browse')}
          >
            <Text style={[styles.bannerCtaText, srStore && styles.bannerCtaTextBlue]}>Shop now</Text>
          </TouchableOpacity>
        </View>

        {loadError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color="#92400E" />
            <Text style={styles.errorBannerText}>{loadError}</Text>
            <TouchableOpacity
              onPress={() => {
                setRefreshing(true)
                void load({ silent: true, bustCache: true })
              }}
              hitSlop={8}
            >
              <Text style={styles.errorRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => router.push('/customer-screens/browse')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            style={[styles.catChip, !selectedCategory && styles.catChipActive]}
          >
            <Ionicons
              name={srStore ? 'storefront-outline' : 'leaf-outline'}
              size={16}
              color={!selectedCategory ? BRAND.white : BRAND.primary}
            />
            <Text style={[styles.catText, !selectedCategory && styles.catTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((c) => {
            const active = selectedCategory === c.name
            return (
              <TouchableOpacity
                key={c.id || c.slug || c.name}
                onPress={() => setSelectedCategory(active ? null : c.name)}
                style={[styles.catChip, active && styles.catChipActive]}
              >
                <Text style={[styles.catText, active && styles.catTextActive]} numberOfLines={1}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Products */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>
            {selectedCategory || 'Featured products'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={BRAND.primary} style={{ paddingVertical: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={40} color={BRAND.textMuted} />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((p) => {
              if (srStore) {
                return (
                  <SrProductCard
                    key={p.id}
                    product={p}
                    width={SR_CARD_WIDTH}
                    onChanged={refreshCartCount}
                  />
                )
              }

              const imageUri = productImageUrl(p)
              const pricing = getProductPricing(p)
              const discount =
                pricing.compareAt && pricing.compareAt > pricing.price && pricing.price > 0
                  ? Math.round(((pricing.compareAt - pricing.price) / pricing.compareAt) * 100)
                  : 0
              return (
                <View key={p.id} style={styles.card}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: '/customer-screens/product-detail',
                        params: { slug: p.slug },
                      })
                    }
                  >
                    <View style={styles.cardImageWrap}>
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.cardImagePlaceholder}>
                          <Ionicons name="image-outline" size={28} color="#C5CDCA" />
                        </View>
                      )}
                      {discount > 0 && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>{discount}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardBodyTop}>
                      <Text numberOfLines={1} style={styles.cardName}>{p.name}</Text>
                      {!!p.category && (
                        <Text numberOfLines={1} style={styles.cardCat}>{p.category}</Text>
                      )}
                      <View style={styles.priceRow}>
                        <Text style={styles.cardPrice}>
                          {formatProductPriceLabel(pricing, formatCurrency)}
                        </Text>
                        {!!pricing.compareAt &&
                          pricing.compareAt > pricing.price &&
                          pricing.price > 0 && (
                            <Text style={styles.cardCompare}>
                              {formatCurrency(pricing.compareAt)}
                            </Text>
                          )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.cardBodyBottom}>
                    <ProductAddToCart product={p} onChanged={refreshCartCount} />
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  scroll: { paddingBottom: 28 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    marginBottom: 16,
    gap: 10,
    minHeight: 56,
  },
  srEyebrow: {
    fontSize: 12,
    color: BRAND.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  headerBrand: { flex: 1, minWidth: 0, paddingRight: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSearchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  headerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    height: 44,
    minWidth: 0,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 15,
    color: BRAND.text,
    paddingVertical: 0,
    minWidth: 0,
  },
  searchCancelBtn: { paddingVertical: 8, paddingHorizontal: 2 },
  searchCancelText: { fontSize: 14, fontWeight: '600', color: BRAND.primaryDark },
  eyebrow: { fontSize: 12, color: BRAND.textMuted, fontWeight: '600', letterSpacing: 0.4 },
  storeTitle: { fontSize: 22, fontWeight: '800', color: BRAND.text, marginTop: 2 },
  hello: { fontSize: 13, color: BRAND.textMuted, marginTop: 4 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnCompact: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  banner: {
    marginHorizontal: H_PAD,
    borderRadius: 22,
    backgroundColor: BRAND.primary,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  bannerTag: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bannerTitle: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  bannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  bannerCtaText: { color: BRAND.primaryDark, fontWeight: '700', fontSize: 14 },
  bannerCtaBlue: {
    backgroundColor: '#FFFFFF',
  },
  bannerCtaTextBlue: {
    color: '#2563EB',
  },
  errorBanner: {
    marginHorizontal: H_PAD,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBannerText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600' },
  errorRetry: { fontSize: 12, fontWeight: '800', color: BRAND.primaryDark },
  sectionHeader: {
    paddingHorizontal: H_PAD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: BRAND.primary },
  catRow: { paddingHorizontal: H_PAD, gap: 8, paddingBottom: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    maxWidth: 160,
  },
  catChipActive: { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
  catText: { fontSize: 13, fontWeight: '600', color: BRAND.text },
  catTextActive: { color: '#fff' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: BRAND.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cardImageWrap: { width: '100%', height: CARD_WIDTH * 0.78, backgroundColor: '#EEF2F0' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FBBF24',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: { fontSize: 10, fontWeight: '800', color: BRAND.text },
  cardBodyTop: { paddingHorizontal: 8, paddingTop: 8 },
  cardBodyBottom: { paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
  cardName: { fontSize: 12, fontWeight: '700', color: BRAND.text },
  cardCat: { fontSize: 10, color: BRAND.textMuted, marginTop: 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  cardPrice: { fontSize: 13, fontWeight: '800', color: BRAND.primaryDark },
  cardCompare: {
    fontSize: 10,
    color: BRAND.textMuted,
    textDecorationLine: 'line-through',
  },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: BRAND.textMuted, fontSize: 14 },
})
