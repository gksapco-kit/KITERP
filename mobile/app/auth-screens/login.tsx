import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { authApi } from '../../api/auth'
import { resolveVendorBySlug, setAuthToken, setVendorId, setVendorSlug } from '../../api/client'

type Role = 'vendor' | 'customer'

export default function LoginScreen() {
  const router = useRouter()
  const { setVendorAuth, setCustomerAuth } = useAuthStore()
  const [role, setSelectedRole] = useState<Role>('vendor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolvedVendor, setResolvedVendor] = useState<{ id: string; slug: string; display_name: string } | null>(null)
  const [resolving, setResolving] = useState(false)

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
    if (role === 'customer' && !resolvedVendor) return Alert.alert('Error', 'Please find a store first')

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
        const tokens = await authApi.customerLogin(email, password)
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
      Alert.alert('Login Failed', err?.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>Welcome to KITERP</Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 }}>Sign in to continue</Text>

        {/* Role Selector */}
        <View style={{ flexDirection: 'row', marginBottom: 24, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
          {(['vendor', 'customer'] as Role[]).map((r) => (
            <TouchableOpacity key={r} onPress={() => { setSelectedRole(r); setResolvedVendor(null) }}
              style={{ flex: 1, paddingVertical: 12, backgroundColor: role === r ? '#2563eb' : '#fff', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', color: role === r ? '#fff' : '#6b7280', textTransform: 'capitalize' }}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {role === 'customer' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Enter store name to connect</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput placeholder="Store slug (e.g. demo-store)" value={storeSlug}
                onChangeText={(t) => { setStoreSlug(t); setResolvedVendor(null) }} autoCapitalize="none"
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14 }} />
              <TouchableOpacity onPress={handleResolveVendor} disabled={resolving || !storeSlug.trim()}
                style={{ backgroundColor: '#2563eb', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', opacity: resolving || !storeSlug.trim() ? 0.5 : 1 }}>
                {resolving ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Find</Text>}
              </TouchableOpacity>
            </View>
            {resolvedVendor && (
              <View style={{ marginTop: 8, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' }}>
                <Text style={{ fontSize: 13, color: '#166534', fontWeight: '600' }}>Connected to: {resolvedVendor.display_name}</Text>
              </View>
            )}
          </View>
        )}

        <TextInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 }} />

        <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry
          style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 14 }} />

        <TouchableOpacity onPress={handleLogin} disabled={loading || (role === 'customer' && !resolvedVendor)}
          style={{ backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center',
            opacity: loading || (role === 'customer' && !resolvedVendor) ? 0.5 : 1 }}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Sign In</Text>}
        </TouchableOpacity>

        {role === 'customer' && resolvedVendor && (
          <TouchableOpacity onPress={() => router.push('/auth-screens/register')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: '#6b7280', fontSize: 14 }}>Don't have an account? <Text style={{ color: '#2563eb', fontWeight: '600' }}>Register</Text></Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
