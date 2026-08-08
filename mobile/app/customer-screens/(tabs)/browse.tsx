import { useEffect, useMemo, useState } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../../api/store'
import { useAuthStore } from '../../../stores/authStore'
import { useCartStore } from '../../../stores/cartStore'
import { formatCurrency } from '../../../lib/utils'
import { productImageUrl } from '../../../lib/mediaUrl'
import { formatProductPriceLabel, getProductPricing } from '../../../lib/productPricing'
import { ProductAddToCart } from '../../../components/ProductAddToCart'
import { BRAND } from '../../../utils/theme'
import type { Product } from '../../../types'

const { width } = Dimensions.get('window')
const CARD_GAP = 10
const H_PAD = 16
const CARD_WIDTH = (width - H_PAD * 2 - CARD_GAP) / 2

export default function BrowseProducts() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const loadCart = useCartStore((s) => s.loadCart)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    storeApi
      .listProducts({ page: 1, size: 80 })
      .then((data) => setProducts(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void loadCart(isAuthenticated)
  }, [isAuthenticated, loadCart])

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
          ListEmptyComponent={
            <Text style={styles.empty}>No products found</Text>
          }
          renderItem={({ item }) => {
            const imageUri = productImageUrl(item)
            const pricing = getProductPricing(item)
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/customer-screens/product-detail',
                      params: { slug: item.slug },
                    })
                  }
                >
                  <View style={styles.imageWrap}>
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
                  </View>
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
  imageWrap: { width: '100%', height: CARD_WIDTH * 0.78, backgroundColor: '#EEF2F0' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
