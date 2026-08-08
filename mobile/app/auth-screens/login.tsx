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
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../stores/authStore'
import { authApi, apiErrorMessage } from '../../api/auth'
import { resolveVendorBySlug, setAuthToken, setVendorId, setVendorSlug } from '../../api/client'
import { isBrandedApp, getVendorSlug, loadVendorBranding } from '../../utils/vendorConfig'
import { BRAND } from '../../utils/theme'

type Role = 'vendor' | 'customer'

export default function LoginScreen() {
  const router = useRouter()
  const { setVendorAuth, setCustomerAuth } = useAuthStore()
  const branded = isBrandedApp()
  const [role, setSelectedRole] = useState<Role>(branded ? 'customer' : 'vendor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolvedVendor, setResolvedVendor] = useState<{
    id: string
    slug: string
    display_name: string
  } | null>(null)
  const [resolving, setResolving] = useState(false)
  const [storeName, setStoreName] = useState(branded ? 'Store' : 'KITERP')

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
    if (!email || !password) return Alert.alert('Error', 'Please fill in all fields')
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
        router.replace('/customer-screens/home')
      }
    } catch (err: any) {
      Alert.alert('Login Failed', apiErrorMessage(err, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {branded ? `Welcome to ${storeName}` : 'Welcome to KITERP'}
        </Text>
        <Text style={styles.sub}>Sign in to continue</Text>

        {!branded && (
          <View style={styles.roleRow}>
            {(['vendor', 'customer'] as Role[]).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => {
                  setSelectedRole(r)
                  setResolvedVendor(null)
                }}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              >
                <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {role === 'customer' && !branded && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Enter store name to connect</Text>
            <View style={styles.findRow}>
              <TextInput
                placeholder="Store slug (e.g. demo-store)"
                value={storeSlug}
                onChangeText={(t) => {
                  setStoreSlug(t)
                  setResolvedVendor(null)
                }}
                autoCapitalize="none"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
              />
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
              <View style={styles.connected}>
                <Text style={styles.connectedText}>
                  Connected to: {resolvedVendor.display_name}
                </Text>
              </View>
            )}
          </View>
        )}

        {branded && role === 'customer' && (
          <View style={styles.connected}>
            {resolving ? (
              <ActivityIndicator color={BRAND.primary} size="small" />
            ) : (
              <Text style={styles.connectedText}>
                {resolvedVendor
                  ? `Connected to: ${resolvedVendor.display_name}`
                  : 'Connecting to store…'}
              </Text>
            )}
          </View>
        )}

        <TextInput
          placeholder="Email or phone"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading || (role === 'customer' && !resolvedVendor)}
          style={[
            styles.submit,
            {
              opacity: loading || (role === 'customer' && !resolvedVendor) ? 0.5 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {role === 'customer' && resolvedVendor && (
          <TouchableOpacity
            onPress={() => router.push('/auth-screens/register')}
            style={{ marginTop: 16, alignItems: 'center' }}
          >
            <Text style={{ color: BRAND.textMuted, fontSize: 14 }}>
              Don&apos;t have an account?{' '}
              <Text style={{ color: BRAND.primary, fontWeight: '700' }}>Register</Text>
            </Text>
          </TouchableOpacity>
        )}

        {branded && role === 'customer' && (
          <TouchableOpacity
            onPress={() => setSelectedRole('vendor')}
            style={{ marginTop: 18, alignItems: 'center' }}
          >
            <Text style={{ color: BRAND.textMuted, fontSize: 13 }}>
              Staff? <Text style={{ color: BRAND.primary, fontWeight: '700' }}>Vendor login</Text>
            </Text>
          </TouchableOpacity>
        )}

        {branded && role === 'vendor' && (
          <TouchableOpacity
            onPress={() => setSelectedRole('customer')}
            style={{ marginTop: 18, alignItems: 'center' }}
          >
            <Text style={{ color: BRAND.primary, fontWeight: '600' }}>Back to customer login</Text>
          </TouchableOpacity>
        )}

        {branded && (
          <TouchableOpacity
            onPress={() => router.replace('/customer-screens/home')}
            style={{ marginTop: 16, alignItems: 'center' }}
          >
            <Text style={{ color: BRAND.primaryDark, fontWeight: '600' }}>
              Continue browsing as guest
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.card },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    color: BRAND.text,
  },
  sub: {
    fontSize: 14,
    color: BRAND.textMuted,
    textAlign: 'center',
    marginBottom: 28,
  },
  roleRow: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  roleBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#fff', alignItems: 'center' },
  roleBtnActive: { backgroundColor: BRAND.primary },
  roleText: {
    fontWeight: '600',
    color: BRAND.textMuted,
    textTransform: 'capitalize',
  },
  roleTextActive: { color: '#fff' },
  label: { fontSize: 13, color: BRAND.textMuted, marginBottom: 6 },
  findRow: { flexDirection: 'row', gap: 8 },
  findBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  findBtnText: { color: 'white', fontWeight: '700' },
  connected: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: BRAND.primarySoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  connectedText: { fontSize: 13, color: '#166534', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  submit: {
    backgroundColor: BRAND.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
})
