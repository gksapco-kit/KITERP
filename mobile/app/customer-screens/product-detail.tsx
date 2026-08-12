import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../api/store'
import { apiErrorMessage } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { formatCurrency } from '../../lib/utils'
import { productImageUrl } from '../../lib/mediaUrl'
import { getProductPricing, isProductInStock } from '../../lib/productPricing'
import { BRAND } from '../../utils/theme'
import type { Product, ProductVariant } from '../../types'

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const addProduct = useCartStore((s) => s.addProduct)
  const hasWishlist = useWishlistStore((s) => s.has)
  const toggleWishlist = useWishlistStore((s) => s.toggleProduct)
  const loadWishlist = useWishlistStore((s) => s.load)
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)
  const wishlisted = product ? hasWishlist(product.id) : false

  useEffect(() => {
    if (isAuthenticated) void loadWishlist(true).catch(() => undefined)
  }, [isAuthenticated, loadWishlist])

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    storeApi
      .getProduct(slug)
      .then((p) => {
        setProduct(p)
        const pricing = getProductPricing(p)
        setSelectedVariantId(pricing.variant?.id || p.variants?.[0]?.id || null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [slug])

  const variants = useMemo(
    () => (product?.variants || []).filter((v) => v.is_active !== false),
    [product],
  )

  const selectedVariant: ProductVariant | null = useMemo(() => {
    if (!variants.length) return null
    return variants.find((v) => v.id === selectedVariantId) || variants[0]
  }, [variants, selectedVariantId])

  const unitPrice = useMemo(() => {
    if (selectedVariant && Number(selectedVariant.price) > 0) {
      return Number(selectedVariant.price)
    }
    return getProductPricing(product).price
  }, [product, selectedVariant])

  const compareAt = useMemo(() => {
    if (selectedVariant?.compare_at_price != null) {
      return Number(selectedVariant.compare_at_price)
    }
    return product?.compare_at_price != null ? Number(product.compare_at_price) : null
  }, [product, selectedVariant])

  const discount =
    compareAt && compareAt > unitPrice && unitPrice > 0
      ? Math.round(((compareAt - unitPrice) / compareAt) * 100)
      : 0

  const addToCart = async () => {
    if (!product) return
    if (!(unitPrice > 0)) {
      Alert.alert('Unavailable', 'This product does not have a sellable price yet.')
      return
    }
    if (!isProductInStock(product) && selectedVariant?.stock_status === 'out_of_stock') {
      Alert.alert('Out of stock', 'This product is currently unavailable.')
      return
    }
    setAdding(true)
    try {
      const lineName = selectedVariant?.name
        ? `${product.name} · ${selectedVariant.name}`
        : product.name
      await addProduct(
        {
          product_id: product.id,
          variant_id: selectedVariant?.id,
          name: lineName,
          qty,
          price: unitPrice,
          image_url: productImageUrl(product) || undefined,
        },
        isAuthenticated,
      )
      Alert.alert('Added', 'Item added to cart', [
        { text: 'Keep shopping', style: 'cancel' },
        { text: 'View cart', onPress: () => router.push('/customer-screens/cart') },
      ])
    } catch (err: any) {
      Alert.alert('Error', apiErrorMessage(err, 'Failed to add'))
    } finally {
      setAdding(false)
    }
  }

  const handleWishlist = async () => {
    if (!product) return
    if (!isAuthenticated) {
      router.push({
        pathname: '/auth-screens/login',
        params: { returnTo: 'wishlist' },
      })
      return
    }
    setWishBusy(true)
    try {
      await toggleWishlist(product, true)
    } catch (err: any) {
      Alert.alert('Wishlist', apiErrorMessage(err, 'Could not update wishlist'))
    } finally {
      setWishBusy(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    )
  }

  if (!product) {
    return <Text style={styles.notFound}>Product not found</Text>
  }

  const heroUri = productImageUrl(product)
  const priceLabel = unitPrice > 0 ? formatCurrency(unitPrice) : 'Price on request'

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView>
        <View style={styles.hero}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="leaf-outline" size={48} color={BRAND.primary} />
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% off</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.wishBtn}
            onPress={handleWishlist}
            disabled={wishBusy}
            accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {wishBusy ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons
                name={wishlisted ? 'heart' : 'heart-outline'}
                size={22}
                color={wishlisted ? '#EF4444' : '#111827'}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{product.name}</Text>
              {!!product.category && (
                <Text style={styles.category}>{product.category}</Text>
              )}
            </View>
            <Text style={styles.price}>{priceLabel}</Text>
          </View>

          {!!compareAt && compareAt > unitPrice && unitPrice > 0 && (
            <Text style={styles.compare}>{formatCurrency(compareAt)}</Text>
          )}

          {variants.length > 1 && (
            <>
              <Text style={styles.sectionLabel}>Options</Text>
              <View style={styles.variantRow}>
                {variants.map((v) => {
                  const active = v.id === selectedVariant?.id
                  const vp = Number(v.price) || 0
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setSelectedVariantId(v.id)}
                      style={[styles.variantChip, active && styles.variantChipActive]}
                    >
                      <Text style={[styles.variantName, active && styles.variantNameActive]}>
                        {v.name || 'Option'}
                      </Text>
                      <Text style={[styles.variantPrice, active && styles.variantNameActive]}>
                        {vp > 0 ? formatCurrency(vp) : '—'}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>Quantity</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              onPress={() => setQty(Math.max(1, qty - 1))}
              style={styles.qtyBtn}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qty}>{qty}</Text>
            <TouchableOpacity onPress={() => setQty(qty + 1)} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {!!product.description && (
            <>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={addToCart}
          disabled={adding || !(unitPrice > 0)}
          style={[styles.cta, { opacity: adding || !(unitPrice > 0) ? 0.7 : 1 }]}
        >
          {adding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="bag-add-outline" size={20} color="#fff" />
              <Text style={styles.ctaText}>
                {unitPrice > 0
                  ? `Add to cart · ${formatCurrency(unitPrice * qty)}`
                  : 'Price on request'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.card },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { textAlign: 'center', padding: 32, color: BRAND.textMuted },
  hero: { width: '100%', height: 320, backgroundColor: '#EEF2F0' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#FBBF24',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  discountText: { fontWeight: '800', fontSize: 12, color: BRAND.text },
  wishBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 24, fontWeight: '800', color: BRAND.text },
  category: { color: BRAND.textMuted, marginTop: 4, fontSize: 14 },
  price: { fontSize: 22, fontWeight: '800', color: BRAND.primaryDark },
  compare: {
    marginTop: 4,
    color: BRAND.textMuted,
    textDecorationLine: 'line-through',
    fontSize: 14,
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.text,
  },
  description: { color: '#4b5563', lineHeight: 22, fontSize: 14 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BRAND.bg,
    minWidth: 110,
  },
  variantChipActive: {
    borderColor: BRAND.primary,
    backgroundColor: BRAND.primarySoft,
  },
  variantName: { fontWeight: '700', color: BRAND.text, fontSize: 13 },
  variantNameActive: { color: BRAND.primaryDark },
  variantPrice: { marginTop: 2, fontSize: 12, color: BRAND.textMuted, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 20, fontWeight: '600', color: BRAND.text },
  qty: { fontSize: 18, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
  },
  cta: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
