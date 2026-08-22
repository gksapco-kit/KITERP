import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../stores/authStore'
import { authApi, apiErrorMessage } from '../../api/auth'
import { resolveVendorBySlug, setAuthToken, setVendorId, setVendorSlug } from '../../api/client'
import { isBrandedApp, getVendorSlug, loadVendorBranding } from '../../utils/vendorConfig'
import { useCartStore } from '../../stores/cartStore'
import { BRAND, withAlpha } from '../../utils/theme'

type Role = 'vendor' | 'customer'

export default function LoginScreen() {
  const router = useRouter()
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const { setVendorAuth, setCustomerAuth } = useAuthStore()
  const branded = isBrandedApp()
  const [role, setSelectedRole] = useState<Role>(branded ? 'customer' : 'vendor')

  useEffect(() => {
    if (branded) setSelectedRole('customer')
  }, [branded])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [storeSlug, setStoreSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolvedVendor, setResolvedVendor] = useState<{
    id: string
    slug: string
    display_name: string
  } | null>(null)
  const [resolving, setResolving] = useState(false)
  const [storeName, setStoreName] = useState(branded ? 'Store' : 'KIT ERP')

  useEffect(() => {
    if (!branded) return
    const slug = getVendorSlug()
    if (!slug) return
    setResolving(true)
    loadVendorBranding()
      .then(async (b) => {
        setStoreName(b.name)
        const vendor = await resolveVendorBySlug(slug)
        setResolvedVendor({
          id: vendor.id,
          slug: vendor.slug,
          display_name: vendor.display_name || b.name,
        })
        setVendorId(vendor.id)
        setVendorSlug(vendor.slug)
      })
      .catch(() => {
        Alert.alert('Store unavailable', 'Could not connect to this store right now.')
      })
      .finally(() => setResolving(false))
  }, [branded])

  const handleResolveVendor = async () => {
    if (!storeSlug.trim()) return
    setResolving(true)
    setResolvedVendor(null)
    try {
      const vendor = await resolveVendorBySlug(storeSlug.trim().toLowerCase())
      setResolvedVendor(vendor)
    } catch {
      Alert.alert('Not Found', 'No active store found with that name.')
    } finally {
      setResolving(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return Alert.alert('Error', 'Please fill in all fields')
    }
    if (role === 'customer' && !resolvedVendor) {
      return Alert.alert('Error', 'Please find a store first')
    }

    setLoading(true)
    try {
      if (role === 'vendor') {
        const tokens = await authApi.vendorLogin(email, password)
        setAuthToken(tokens.access_token)
        const user = await authApi.vendorMe()
        setVendorAuth(user, tokens)
        router.replace('/vendor-screens/dashboard')
      } else {
        setVendorId(resolvedVendor!.id)
        setVendorSlug(resolvedVendor!.slug)
        const tokens = await authApi.customerLogin(email.trim(), password)
        setAuthToken(tokens.access_token)
        const customer = await authApi.customerMe()
        setCustomerAuth(customer, tokens, {
          id: resolvedVendor!.id,
          slug: resolvedVendor!.slug,
          display_name: resolvedVendor!.display_name,
        })
        try {
          await useCartStore.getState().mergeGuestIntoServer()
        } catch (e) {
          console.error(e)
        }
        if (returnTo === 'checkout') {
          router.replace('/customer-screens/checkout')
        } else if (returnTo === 'wishlist') {
          router.replace('/customer-screens/wishlist')
        } else if (returnTo === 'my-rentals') {
          router.replace('/customer-screens/my-rentals')
        } else if (returnTo === 'rentals') {
          router.replace('/customer-screens/rental')
        } else {
          router.replace('/customer-screens/home')
        }
      }
    } catch (err: any) {
      Alert.alert('Login Failed', apiErrorMessage(err, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (router.canGoBack()) {
      router.back()
    } else if (branded) {
      router.replace('/customer-screens/home')
    } else {
      router.replace('/')
    }
  }

  const canSubmit = !loading && !(role === 'customer' && !resolvedVendor)

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.orbTop} pointerEvents="none" />
      <View style={styles.orbBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={BRAND.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Sign in</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name={branded || role === 'customer' ? 'leaf' : 'briefcase-outline'}
                size={26}
                color={BRAND.primaryDark}
              />
            </View>
            <Text style={styles.heroTitle}>
              {branded ? 'Welcome back' : 'Welcome to KIT ERP'}
            </Text>
            <Text style={styles.heroSub}>
              {branded
                ? `Sign in to ${storeName} to track orders and checkout faster`
                : role === 'vendor'
                  ? 'Sign in to manage orders and store settings'
                  : 'Sign in to continue'}
            </Text>
          </View>

          {!branded && (
            <View style={styles.segment}>
              {(['vendor', 'customer'] as Role[]).map((r) => {
                const active = role === r
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => {
                      setSelectedRole(r)
                      setResolvedVendor(null)
                    }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {r === 'vendor' ? 'Vendor' : 'Customer'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {branded && (
            <View style={styles.storePill}>
              {resolving ? (
                <ActivityIndicator color={BRAND.primaryDark} size="small" />
              ) : (
                <>
                  <Ionicons name="storefront-outline" size={16} color={BRAND.primaryDark} />
                  <Text style={styles.storePillText}>
                    {resolvedVendor?.display_name || storeName}
                  </Text>
                  {!!resolvedVendor && (
                    <Ionicons name="checkmark-circle" size={16} color={BRAND.primaryDark} />
                  )}
                </>
              )}
            </View>
          )}

          {role === 'customer' && !branded && (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Connect to a store</Text>
              <View style={styles.findRow}>
                <View style={[styles.fieldRow, { flex: 1 }]}>
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={BRAND.textMuted}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    placeholder="Store slug (e.g. demo-store)"
                    placeholderTextColor={BRAND.textMuted}
                    value={storeSlug}
                    onChangeText={(t) => {
                      setStoreSlug(t)
                      setResolvedVendor(null)
                    }}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleResolveVendor}
                  disabled={resolving || !storeSlug.trim()}
                  style={[
                    styles.findBtn,
                    { opacity: resolving || !storeSlug.trim() ? 0.5 : 1 },
                  ]}
                >
                  {resolving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.findBtnText}>Find</Text>
                  )}
                </TouchableOpacity>
              </View>
              {resolvedVendor && (
                <View style={styles.connectedInline}>
                  <Ionicons name="checkmark-circle" size={16} color={BRAND.primaryDark} />
                  <Text style={styles.connectedInlineText}>
                    Connected to {resolvedVendor.display_name}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              {role === 'vendor' ? 'Email' : 'Email or phone'}
            </Text>
            <View style={styles.fieldRow}>
              <Ionicons
                name={role === 'vendor' ? 'mail-outline' : 'person-outline'}
                size={18}
                color={BRAND.textMuted}
                style={styles.fieldIcon}
              />
              <TextInput
                placeholder={role === 'vendor' ? 'you@company.com' : 'Email or phone'}
                placeholderTextColor={BRAND.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Password</Text>
            <View style={styles.fieldRow}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={BRAND.textMuted}
                style={styles.fieldIcon}
              />
              <TextInput
                placeholder="Your password"
                placeholderTextColor={BRAND.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={BRAND.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={!canSubmit}
            style={[styles.submit, { opacity: canSubmit ? 1 : 0.5 }]}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.submitText}>Sign in</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {role === 'customer' && (!!resolvedVendor || branded) && (
            <TouchableOpacity
              onPress={() => router.push('/auth-screens/register')}
              style={styles.footerLink}
            >
              <Text style={styles.footerMuted}>
                Don&apos;t have an account?{' '}
                <Text style={styles.footerAccent}>Create account</Text>
              </Text>
            </TouchableOpacity>
          )}

          {branded && (
            <TouchableOpacity
              onPress={() => router.replace('/customer-screens/home')}
              style={styles.guestBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="storefront-outline" size={16} color={BRAND.primaryDark} />
              <Text style={styles.guestBtnText}>Continue browsing as guest</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  orbTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: withAlpha(BRAND.primary, 0.16),
  },
  orbBottom: {
    position: 'absolute',
    bottom: -100,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withAlpha(BRAND.primaryDark, 0.1),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 4,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: BRAND.text,
    textAlign: 'center',
  },
  heroSub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: BRAND.textMuted,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: BRAND.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: BRAND.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.textMuted,
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: '#fff',
  },
  storePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginBottom: 14,
    minHeight: 36,
  },
  storePillText: {
    color: BRAND.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.bg,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: BRAND.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  eyeBtn: {
    padding: 4,
  },
  findRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  findBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
  },
  findBtnText: { color: 'white', fontWeight: '800' },
  connectedInline: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectedInlineText: {
    fontSize: 13,
    color: BRAND.primaryDark,
    fontWeight: '700',
  },
  submit: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  submitText: { color: 'white', fontWeight: '800', fontSize: 16 },
  footerLink: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerMuted: {
    color: BRAND.textMuted,
    fontSize: 14,
  },
  footerAccent: {
    color: BRAND.primaryDark,
    fontWeight: '800',
  },
  guestBtn: {
    marginTop: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  guestBtnText: {
    color: BRAND.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
})
