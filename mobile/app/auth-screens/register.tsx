import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { authApi } from '../../api/auth'
import { setVendorId } from '../../api/client'

export default function RegisterScreen() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [vendorId, setVendorIdInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!fullName || !email || !password || !vendorId) return Alert.alert('Error', 'Please fill in all fields')
    if (password.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters')

    setLoading(true)
    try {
      setVendorId(vendorId)
      await authApi.customerRegister({ full_name: fullName, email, password })
      Alert.alert('Success', 'Account created! Please login.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>Create Account</Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 }}>Register as a customer</Text>

        <TextInput placeholder="Vendor ID" value={vendorId} onChangeText={setVendorIdInput} style={inputStyle} />
        <TextInput placeholder="Full Name" value={fullName} onChangeText={setFullName} style={inputStyle} />
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />
        <TextInput placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry style={inputStyle} />

        <TouchableOpacity onPress={handleRegister} disabled={loading}
          style={{ backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12, opacity: loading ? 0.7 : 1 }}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 14 }}>Already have an account? <Text style={{ color: '#2563eb', fontWeight: '600' }}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
