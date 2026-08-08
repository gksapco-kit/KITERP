import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiErrorMessage } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { productImageUrl } from '../lib/mediaUrl'
import { getProductPricing, isProductInStock } from '../lib/productPricing'
import { BRAND } from '../utils/theme'
import type { Product } from '../types'

type Props = {
  product: Product
  onChanged?: () => void
}

/**
 * Website-style control:
 * - not in cart → "Add" only
 * - in cart → Add | − qty +
 * Guests can add locally; sign-in is only required at checkout.
 */
export function ProductAddToCart({ product, onChanged }: Props) {
  const { isAuthenticated } = useAuthStore()
  const addProduct = useCartStore((s) => s.addProduct)
  const setProductQty = useCartStore((s) => s.setProductQty)
  const pricing = getProductPricing(product)
  const variantId = pricing.variant?.id
  const cartQty = useCartStore(
    (s) => s.qtyByKey[`${product.id}::${variantId || ''}`] || 0,
  )
  const [busy, setBusy] = useState(false)
  const inStock = isProductInStock(product)

  const buildLine = () => {
    const variant = pricing.variant
    return {
      product_id: product.id,
      variant_id: variant?.id,
      name: variant?.name ? `${product.name} · ${variant.name}` : product.name,
      qty: 1,
      price: pricing.price,
      image_url: productImageUrl(product) || undefined,
    }
  }

  const handleAdd = async () => {
    if (!inStock) {
      Alert.alert('Out of stock', 'This product is currently unavailable.')
      return
    }
    if (!(pricing.price > 0)) {
      Alert.alert('Unavailable', 'This product does not have a sellable price yet.')
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
      await setProductQty(product.id, variantId, nextQty, isAuthenticated, buildLine())
      onChanged?.()
    } catch (err: any) {
      Alert.alert('Could not update', apiErrorMessage(err, 'Failed to update cart'))
    } finally {
      setBusy(false)
    }
  }

  if (!inStock && cartQty <= 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.stockBadgeOut}>
          <Text style={styles.stockOutText}>Out of Stock</Text>
        </View>
        <View style={[styles.pill, styles.pillDisabled]}>
          <Text style={styles.addText}>Out of Stock</Text>
        </View>
      </View>
    )
  }

  if (cartQty <= 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.stockBadge}>
          <Text style={styles.stockText}>In Stock</Text>
        </View>
        <TouchableOpacity
          style={[styles.pill, styles.pillAddOnly]}
          onPress={handleAdd}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cart-outline" size={16} color="#fff" />
              <Text style={styles.addText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.stockBadge}>
        <Text style={styles.stockText}>In Stock</Text>
      </View>
      <View style={styles.pill}>
        <View style={styles.addSide}>
          <Ionicons name="cart-outline" size={16} color="#fff" />
          <Text style={styles.addText}>Add</Text>
        </View>

        <View style={styles.qtySide}>
          <TouchableOpacity
            style={styles.qtyHit}
            onPress={() => handleQtyChange(cartQty - 1)}
            disabled={busy}
            hitSlop={6}
          >
            <Text style={styles.qtyBtn}>−</Text>
          </TouchableOpacity>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" style={{ minWidth: 18 }} />
          ) : (
            <Text style={styles.qtyValue}>{cartQty}</Text>
          )}
          <TouchableOpacity
            style={styles.qtyHit}
            onPress={() => handleQtyChange(cartQty + 1)}
            disabled={busy || !inStock}
            hitSlop={6}
          >
            <Text style={styles.qtyBtn}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 4,
  },
  stockBadgeOut: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.dangerSoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 4,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.primaryDark,
  },
  stockOutText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.danger,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND.primary,
    borderRadius: 10,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  pillAddOnly: {
    justifyContent: 'center',
    gap: 5,
  },
  pillDisabled: {
    opacity: 0.55,
    justifyContent: 'center',
  },
  addSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  addText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  qtySide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyHit: {
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtn: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  qtyValue: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    minWidth: 18,
    textAlign: 'center',
  },
})
