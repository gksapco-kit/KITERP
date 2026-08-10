import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { storeApi } from '../../api/store'
import { apiErrorMessage } from '../../api/auth'
import { setAuthToken, setVendorId, setVendorSlug } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { getVendorSlug, loadVendorBranding } from '../../utils/vendorConfig'
import { formatCurrency } from '../../lib/utils'
import { BRAND, withAlpha } from '../../utils/theme'

function Field({
  label,
  icon,
  children,
  style,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  children: ReactNode
  style?: object
}) {
  return (
    <View style={[styles.fieldBlock, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Ionicons name={icon} size={17} color={BRAND.textMuted} style={styles.fieldIcon} />
        {children}
      </View>
    </View>
  )
}

export default function CheckoutScreen() {
  const router = useRouter()
  const { isAuthenticated, setCustomerAuth, customer, vendorInfo } = useAuthStore()
  const items = useCartStore((s) => s.items)
  const clearLocal = useCartStore((s) => s.clearLocal)

  const [fullName, setFullName] = useState(customer?.full_name || '')
  const [email, setEmail] = useState(customer?.email || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  /** Delivery contact — autofill when account has phone (phone signup/login). */
  const [shippingPhone, setShippingPhone] = useState(customer?.phone || '')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod')
  const [loading, setLoading] = useState(false)

  const phoneDigits = (value: string) => value.replace(/\D/g, '')
  const hasAccountPhone = !!(customer?.phone && phoneDigits(customer.phone).length >= 10)

  useEffect(() => {
    const accountPhone = customer?.phone?.trim()
    if (!accountPhone) return
    setShippingPhone((prev) => (prev.trim() ? prev : accountPhone))
  }, [customer?.phone])

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + (i.qty || 0), 0),
    [items],
  )
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.qty, 0),
    [items],
  )

  const goAfterOrder = (order: { id: string; order_number: string }) => {
    if (paymentMethod === 'upi') {
      router.replace({
        pathname: '/customer-screens/upi-payment',
        params: { orderId: order.id },
      })
      return
    }
    clearLocal()
    void useCartStore.getState().loadCart(true).catch(() => undefined)
    router.replace({
      pathname: '/customer-screens/order-success',
      params: {
        orderId: order.id,
        orderNumber: order.order_number,
      },
    })
  }

  const handleCheckout = async () => {
    if (!items.length) {
      return Alert.alert('Empty cart', 'Add products before checkout.')
    }
    if (!street.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      return Alert.alert('Address needed', 'Fill in all shipping address fields')
    }
    if (phoneDigits(shippingPhone).length < 10) {
      return Alert.alert(
        'Phone required',
        hasAccountPhone
          ? 'Enter a valid 10-digit delivery phone number'
          : 'Add a phone number for delivery updates (required when you signed in with email)',
      )
    }

    if (!isAuthenticated) {
      if (!fullName.trim() || !email.trim()) {
        return Alert.alert('Error', 'Enter your name and email to continue as guest')
      }
      if (phone.trim() && phoneDigits(phone).length < 10) {
        return Alert.alert('Error', 'Phone must be at least 10 digits')
      }
    }

    setLoading(true)
    try {
      const shipping_address = {
        street_address: street.trim(),
        city: city.trim(),
        state: state.trim(),
        postal_code: postalCode.trim(),
        country: 'India',
        phone: shippingPhone.trim(),
      }

      if (isAuthenticated) {
        const order = await storeApi.checkout({
          shipping_address,
          payment_method: paymentMethod,
        })
        goAfterOrder(order)
        return
      }

      const result = await storeApi.guestCheckout({
        customer: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || shippingPhone.trim() || undefined,
        },
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          image_url: i.image_url,
        })),
        shipping_address,
        payment_method: paymentMethod,
      })

      if (result.access_token) {
        const branding = await loadVendorBranding()
        const slug = getVendorSlug() || branding.vendorSlug || 'rainbow-nursery'
        setAuthToken(result.access_token)
        if (branding.vendorId) setVendorId(branding.vendorId)
        setVendorSlug(slug)
        if (result.customer) {
          setCustomerAuth(
            {
              id: result.customer.id,
              vendor_id: branding.vendorId || '',
              full_name: result.customer.full_name,
              email: result.customer.email,
              phone: result.customer.phone,
              shipping_addresses: [],
              total_orders: 0,
              total_spent: 0,
            },
            {
              access_token: result.access_token,
              refresh_token: result.refresh_token || '',
              token_type: 'bearer',
            },
            {
              id: branding.vendorId || vendorInfo?.id || '',
              slug,
              display_name: branding.name || vendorInfo?.display_name || slug,
            },
          )
        }
      }

      clearLocal()
      goAfterOrder(result)
    } catch (err: any) {
      const msg = apiErrorMessage(err, 'Could not place order')
      if (String(msg).toLowerCase().includes('sign in is required')) {
        Alert.alert('Sign in required', msg, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign in',
            onPress: () =>
              router.push({
                pathname: '/auth-screens/login',
                params: { returnTo: 'checkout' },
              }),
          },
        ])
      } else {
        Alert.alert('Checkout failed', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const methods = [
    {
      value: 'cod' as const,
      label: 'Cash on Delivery',
      sub: 'Pay when your order arrives',
      icon: 'cash-outline' as const,
    },
    {
      value: 'upi' as const,
      label: 'UPI payment',
      sub: 'Scan QR, then upload payment proof',
      icon: 'qr-code-outline' as const,
    },
  ]

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.orb} pointerEvents="none" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="bag-handle-outline" size={20} color={BRAND.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Order summary</Text>
              <Text style={styles.summarySub}>
                {itemCount} item{itemCount === 1 ? '' : 's'} in your bag
              </Text>
            </View>
            <Text style={styles.summaryTotal}>{formatCurrency(subtotal)}</Text>
          </View>

          {!isAuthenticated && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={18} color={BRAND.primaryDark} />
                <Text style={styles.cardTitle}>Contact</Text>
              </View>
              <Text style={styles.cardHint}>Guest checkout — we’ll use this for order updates</Text>

              <Field label="Full name" icon="person-outline">
                <TextInput
                  placeholder="Your name"
                  placeholderTextColor={BRAND.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </Field>
              <Field label="Email" icon="mail-outline">
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor={BRAND.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>
              <Field label="Phone (optional)" icon="call-outline" style={{ marginBottom: 0 }}>
                <TextInput
                  placeholder="9876543210"
                  placeholderTextColor={BRAND.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </Field>

              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/auth-screens/login',
                    params: { returnTo: 'checkout' },
                  })
                }
                style={styles.signInRow}
              >
                <Text style={styles.signInLink}>
                  Already have an account?{' '}
                  <Text style={styles.signInAccent}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isAuthenticated && !!customer && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="checkmark-circle" size={18} color={BRAND.primaryDark} />
                <Text style={styles.cardTitle}>Signed in</Text>
              </View>
              <Text style={styles.signedName}>{customer.full_name}</Text>
              {!!customer.email && (
                <Text style={styles.signedMeta}>{customer.email}</Text>
              )}
              {!!customer.phone && (
                <Text style={styles.signedMeta}>{customer.phone}</Text>
              )}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="location-outline" size={18} color={BRAND.primaryDark} />
              <Text style={styles.cardTitle}>Shipping address</Text>
            </View>

            <Field label="Street address" icon="home-outline">
              <TextInput
                placeholder="House no, street, area"
                placeholderTextColor={BRAND.textMuted}
                value={street}
                onChangeText={setStreet}
                style={styles.input}
              />
            </Field>

            <View style={styles.row}>
              <Field label="City" icon="business-outline" style={{ flex: 1, marginBottom: 12 }}>
                <TextInput
                  placeholder="City"
                  placeholderTextColor={BRAND.textMuted}
                  value={city}
                  onChangeText={setCity}
                  style={styles.input}
                />
              </Field>
              <Field label="State" icon="map-outline" style={{ flex: 1, marginBottom: 12 }}>
                <TextInput
                  placeholder="State"
                  placeholderTextColor={BRAND.textMuted}
                  value={state}
                  onChangeText={setState}
                  style={styles.input}
                />
              </Field>
            </View>

            <Field label="Postal code" icon="pin-outline">
              <TextInput
                placeholder="6-digit PIN"
                placeholderTextColor={BRAND.textMuted}
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="number-pad"
                style={styles.input}
                maxLength={10}
              />
            </Field>

            <Field
              label={hasAccountPhone ? 'Phone number' : 'Phone number (required)'}
              icon="call-outline"
              style={{ marginBottom: 0 }}
            >
              <TextInput
                placeholder={
                  hasAccountPhone
                    ? 'Delivery phone'
                    : 'Required for delivery updates'
                }
                placeholderTextColor={BRAND.textMuted}
                value={shippingPhone}
                onChangeText={setShippingPhone}
                keyboardType="phone-pad"
                style={styles.input}
                autoComplete="tel"
              />
            </Field>
            {isAuthenticated && !hasAccountPhone ? (
              <Text style={styles.phoneHint}>
                You signed in with email — add a phone number so we can contact you about this delivery.
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="card-outline" size={18} color={BRAND.primaryDark} />
              <Text style={styles.cardTitle}>Payment method</Text>
            </View>

            {methods.map((m) => {
              const active = paymentMethod === m.value
              return (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setPaymentMethod(m.value)}
                  style={[styles.method, active && styles.methodActive]}
                  activeOpacity={0.85}
                >
                  <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                    <Ionicons
                      name={m.icon}
                      size={20}
                      color={active ? BRAND.primaryDark : BRAND.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                      {m.label}
                    </Text>
                    <Text style={styles.methodSub}>{m.sub}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )
            })}

            {paymentMethod === 'upi' && (
              <View style={styles.upiNote}>
                <Ionicons name="information-circle-outline" size={16} color={BRAND.primaryDark} />
                <Text style={styles.upiNoteText}>
                  Next you’ll see the UPI QR. Pay, then upload screenshot + transaction ID.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text style={styles.footerTotalLabel}>Total</Text>
            <Text style={styles.footerTotalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <TouchableOpacity
            onPress={handleCheckout}
            disabled={loading || !items.length}
            style={[styles.cta, { opacity: loading || !items.length ? 0.7 : 1 }]}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {paymentMethod === 'upi' ? 'Continue to UPI payment' : 'Place order'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  orb: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: withAlpha(BRAND.primary, 0.12),
  },
  scroll: { padding: 16, paddingBottom: 20 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text },
  summarySub: { marginTop: 2, fontSize: 12, color: BRAND.textMuted },
  summaryTotal: { fontSize: 16, fontWeight: '800', color: BRAND.primaryDark },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: BRAND.text },
  cardHint: {
    fontSize: 12,
    color: BRAND.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.textMuted,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.bg,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  fieldIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: BRAND.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  signInRow: { marginTop: 12, alignItems: 'center' },
  signInLink: { color: BRAND.textMuted, fontSize: 13 },
  signInAccent: { color: BRAND.primaryDark, fontWeight: '800' },
  signedName: { fontSize: 15, fontWeight: '700', color: BRAND.text, marginTop: 4 },
  signedMeta: { fontSize: 13, color: BRAND.textMuted, marginTop: 2 },
  phoneHint: {
    marginTop: 8,
    fontSize: 12,
    color: BRAND.textMuted,
    lineHeight: 17,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: BRAND.bg,
  },
  methodActive: {
    borderColor: BRAND.primary,
    backgroundColor: BRAND.primarySoft,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconActive: {
    backgroundColor: withAlpha(BRAND.primary, 0.2),
  },
  methodLabel: { fontWeight: '700', color: BRAND.text, fontSize: 14 },
  methodLabelActive: { color: BRAND.primaryDark },
  methodSub: { marginTop: 2, fontSize: 11, color: BRAND.textMuted, lineHeight: 15 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: BRAND.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.primary },
  upiNote: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: withAlpha(BRAND.primary, 0.1),
    borderRadius: 12,
    padding: 12,
  },
  upiNoteText: {
    flex: 1,
    fontSize: 12,
    color: BRAND.primaryDark,
    lineHeight: 17,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
  },
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  footerTotalLabel: { fontSize: 14, color: BRAND.textMuted, fontWeight: '600' },
  footerTotalValue: { fontSize: 20, fontWeight: '800', color: BRAND.text },
  cta: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: 'white', fontWeight: '800', fontSize: 16 },
})
