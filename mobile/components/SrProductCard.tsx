import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiErrorMessage } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useWishlistStore } from '../stores/wishlistStore'
import { productImageUrl } from '../lib/mediaUrl'
import { formatCurrency } from '../lib/utils'
import { BRAND } from '../utils/theme'
import type { Product, ProductVariant } from '../types'

type Props = {
  product: Product
  width: number
  onChanged?: () => void
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function sellableVariants(product: Product): ProductVariant[] {
  const list = Array.isArray(product.variants) ? product.variants : []
  return list
    .filter((v) => v && v.is_active !== false)
    .filter((v) => v.price_type !== 'not_applicable')
    .sort((a, b) => toNumber(a.price) - toNumber(b.price))
}

function variantInStock(v?: ProductVariant | null): boolean {
  if (!v) return false
  if (v.stock_status === 'out_of_stock') return false
  if (v.quantity != null) return toNumber(v.quantity) > 0 || v.stock_status === 'backorder'
  return v.stock_status !== 'out_of_stock'
}

/** SR Marketing home card: image, weight variants, price, Add to Cart. */
export function SrProductCard({ product, width, onChanged }: Props) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const addProduct = useCartStore((s) => s.addProduct)
  const setProductQty = useCartStore((s) => s.setProductQty)
  const wishlisted = useWishlistStore((s) => s.has(product.id))
  const toggleWishlist = useWishlistStore((s) => s.toggleProduct)
  const [wishBusy, setWishBusy] = useState(false)
  const variants = useMemo(() => sellableVariants(product), [product])

  const defaultVariantId = useMemo(() => {
    const priced = variants.filter((v) => toNumber(v.price) > 0)
    return (priced[0] || variants[0])?.id || null
  }, [variants])

  const [selectedId, setSelectedId] = useState<string | null>(defaultVariantId)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelectedId(defaultVariantId)
  }, [product.id, defaultVariantId])

  const selected =
    variants.find((v) => v.id === selectedId) ||
    variants.find((v) => v.id === defaultVariantId) ||
    variants[0] ||
    null

  const price = selected ? toNumber(selected.price) : toNumber(product.price)
  const compareAt = selected
    ? toNumber(selected.compare_at_price) || toNumber(product.compare_at_price)
    : toNumber(product.compare_at_price)
  const imageUri = productImageUrl(product)
  const inStock = selected
    ? variantInStock(selected)
    : product.stock_status !== 'out_of_stock'
  const cartQty = useCartStore(
    (s) => s.qtyByKey[`${product.id}::${selected?.id || ''}`] || 0,
  )

  const buildLine = () => ({
    product_id: product.id,
    variant_id: selected?.id,
    name: selected?.name ? `${product.name} · ${selected.name}` : product.name,
    qty: 1,
    price,
    image_url: imageUri || undefined,
  })

  const handleAdd = async () => {
    if (!inStock) {
      Alert.alert('Out of stock', 'This option is currently unavailable.')
      return
    }
    if (!(price > 0)) {
      Alert.alert('Unavailable', 'This option does not have a sellable price yet.')
      return
    }
    setBusy(true)
    try {
      await addProduct(buildLine(), isAuthenticated)
      onChanged?.()
    } catch (err: any) {
      Alert.alert('Could not add', apiErrorMessage(err, 'Failed to add to cart'))
    } finally {
      setBusy(false)
    }
  }

  const handleQtyChange = async (nextQty: number) => {
    setBusy(true)
    try {
      await setProductQty(product.id, selected?.id, nextQty, isAuthenticated, buildLine())
      onChanged?.()
    } catch (err: any) {
      Alert.alert('Could not update', apiErrorMessage(err, 'Failed to update cart'))
    } finally {
      setBusy(false)
    }
  }

  const handleWishlist = async () => {
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

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.imageWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={StyleSheet.absoluteFill}
          onPress={() =>
            router.push({
              pathname: '/customer-screens/product-detail',
              params: { slug: product.slug },
            })
          }
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#C5CDCA" />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.wishBtn}
          onPress={handleWishlist}
          disabled={wishBusy}
          hitSlop={8}
          accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {wishBusy ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={wishlisted ? '#EF4444' : '#111827'}
            />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>

        {variants.length > 0 ? (
          <View style={styles.variantBlock}>
            <Text style={styles.weightLabel}>WEIGHT</Text>
            <View style={styles.variantWrap}>
              {variants.map((v) => {
                const active = v.id === (selected?.id || selectedId)
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setSelectedId(v.id)}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {(v.name || 'Option').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ) : null}

        <Text style={styles.price}>
          {price > 0 ? formatCurrency(price) : 'Ask'}
        </Text>
        {!!compareAt && compareAt > price && price > 0 ? (
          <Text style={styles.compare}>{formatCurrency(compareAt)}</Text>
        ) : null}

        {!inStock && cartQty <= 0 ? (
          <View style={[styles.cta, styles.ctaDisabled]}>
            <Text style={styles.ctaText}>Out of Stock</Text>
          </View>
        ) : cartQty <= 0 ? (
          <TouchableOpacity
            style={styles.cta}
            onPress={handleAdd}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={15} color="#fff" />
                <Text style={styles.ctaText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.qtyBar}>
            <TouchableOpacity
              style={styles.qtyHit}
              onPress={() => handleQtyChange(cartQty - 1)}
              disabled={busy}
            >
              <Text style={styles.qtyBtn}>−</Text>
            </TouchableOpacity>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.qtyValue}>{cartQty}</Text>
            )}
            <TouchableOpacity
              style={styles.qtyHit}
              onPress={() => handleQtyChange(cartQty + 1)}
              disabled={busy || !inStock}
            >
              <Text style={styles.qtyBtn}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#EEF2F0',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wishBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  body: { padding: 8 },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.text,
    marginBottom: 6,
  },
  variantBlock: {
    marginBottom: 6,
  },
  weightLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: BRAND.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  variantWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  chipActive: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '700',
    color: BRAND.text,
  },
  chipTextActive: { color: '#fff' },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.text,
    marginBottom: 6,
  },
  compare: {
    marginTop: -4,
    marginBottom: 6,
    fontSize: 11,
    color: BRAND.textMuted,
    textDecorationLine: 'line-through',
  },
  cta: {
    backgroundColor: BRAND.primary,
    borderRadius: 10,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  qtyBar: {
    backgroundColor: BRAND.primary,
    borderRadius: 10,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  qtyHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtn: { color: '#fff', fontSize: 18, fontWeight: '700' },
  qtyValue: { color: '#fff', fontSize: 13, fontWeight: '800', minWidth: 20, textAlign: 'center' },
})
