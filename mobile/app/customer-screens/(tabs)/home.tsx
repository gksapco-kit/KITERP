import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi, type StoreCategory } from '../../../api/store'
import { useAuthStore } from '../../../stores/authStore'
import { formatCurrency } from '../../../lib/utils'
import { productImageUrl } from '../../../lib/mediaUrl'
import { formatProductPriceLabel, getProductPricing } from '../../../lib/productPricing'
import { loadVendorBranding } from '../../../utils/vendorConfig'
import { BRAND } from '../../../utils/theme'
import { ProductAddToCart } from '../../../components/ProductAddToCart'
import { useCartStore } from '../../../stores/cartStore'
import type { Product } from '../../../types'

const { width } = Dimensions.get('window')
const CARD_GAP = 12
const H_PAD = 16
const CARD_WIDTH = (width - H_PAD * 2 - CARD_GAP) / 2

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
  const loadCart = useCartStore((s) => s.loadCart)
  const cartItemCount = useCartStore((s) => s.itemCount)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [storeName, setStoreName] = useState(vendorInfo?.display_name || 'Store')

  const refreshCartCount = useCallback(async () => {
    if (!isAuthenticated) {
      useCartStore.getState().clearLocal()
      return
    }
    await loadCart()
  }, [isAuthenticated, loadCart])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const branding = await loadVendorBranding()
      if (branding.name) setStoreName(branding.name)

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
      await refreshCartCount()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, refreshCartCount])

  useEffect(() => {
    load()
  }, [load])

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Welcome to</Text>
            <Text style={styles.storeTitle} numberOfLines={1}>{storeName}</Text>
            <Text style={styles.hello}>Hello, {greeting}</Text>
          </View>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => router.push('/customer-screens/cart')}
          >
            <Ionicons name="bag-handle-outline" size={22} color={BRAND.white} />
            {cartItemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartItemCount > 9 ? '9+' : cartItemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Promo banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTag}>FRESH & GREEN</Text>
          <Text style={styles.bannerTitle}>Root Nature Grow</Text>
          <Text style={styles.bannerSub}>
            Healthy plants, gardening essentials & expert care — for home and terrace.
          </Text>
          <TouchableOpacity
            style={styles.bannerCta}
            onPress={() => router.push('/customer-screens/browse')}
          >
            <Text style={styles.bannerCtaText}>Shop now</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={BRAND.textMuted} />
          <TextInput
            placeholder="Search plants, pots, tools…"
            placeholderTextColor={BRAND.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={BRAND.textMuted} />
            </TouchableOpacity>
          )}
        </View>

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
              name="leaf-outline"
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
                      <Text numberOfLines={2} style={styles.cardName}>{p.name}</Text>
                      {!!p.category && (
                        <Text numberOfLines={1} style={styles.cardCat}>{p.category}</Text>
                      )}
                      <Text style={styles.cardPrice}>
                        {formatProductPriceLabel(pricing, formatCurrency)}
                      </Text>
                      {!!pricing.compareAt && pricing.compareAt > pricing.price && pricing.price > 0 && (
                        <Text style={styles.cardCompare}>
                          {formatCurrency(pricing.compareAt)}
                        </Text>
                      )}
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
    alignItems: 'flex-start',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    marginBottom: 16,
  },
  eyebrow: { fontSize: 12, color: BRAND.textMuted, fontWeight: '600', letterSpacing: 0.4 },
  storeTitle: { fontSize: 22, fontWeight: '800', color: BRAND.text, marginTop: 2 },
  hello: { fontSize: 13, color: BRAND.textMuted, marginTop: 4 },
  cartBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
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
  bannerTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  bannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  bannerCtaText: { color: BRAND.primaryDark, fontWeight: '700', fontSize: 14 },
  searchBox: {
    marginHorizontal: H_PAD,
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  searchInput: { flex: 1, fontSize: 15, color: BRAND.text, paddingVertical: 0 },
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
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cardImageWrap: { width: '100%', height: CARD_WIDTH * 0.95, backgroundColor: '#EEF2F0' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FBBF24',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  discountText: { fontSize: 11, fontWeight: '800', color: BRAND.text },
  cardBodyTop: { paddingHorizontal: 12, paddingTop: 12 },
  cardBodyBottom: { paddingHorizontal: 12, paddingBottom: 12 },
  cardName: { fontSize: 13, fontWeight: '600', color: BRAND.text, minHeight: 34 },
  cardCat: { fontSize: 11, color: BRAND.textMuted, marginTop: 2 },
  cardPrice: { fontSize: 14, fontWeight: '800', color: BRAND.primaryDark, marginTop: 8 },
  cardCompare: {
    fontSize: 11,
    color: BRAND.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: BRAND.textMuted, fontSize: 14 },
})
