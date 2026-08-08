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
import { authApi, apiErrorMessage } from '../../api/auth'
import { resolveVendorBySlug, setVendorId, setVendorSlug } from '../../api/client'
import { getVendorSlug, isBrandedApp, loadVendorBranding } from '../../utils/vendorConfig'
import { BRAND } from '../../utils/theme'

export default function RegisterScreen() {
  const router = useRouter()
  const branded = isBrandedApp()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [vendorId, setVendorIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [storeLabel, setStoreLabel] = useState('')

  useEffect(() => {
    if (!branded) return
    const slug = getVendorSlug()
    if (!slug) return
    loadVendorBranding()
      .then(async (b) => {
        setStoreLabel(b.name)
        const vendor = await resolveVendorBySlug(slug)
        setVendorIdInput(vendor.id)
        setVendorId(vendor.id)
        setVendorSlug(vendor.slug)
      })
      .catch(console.error)
  }, [branded])

  const sendOtp = async () => {
    if (!email.trim()) return Alert.alert('Error', 'Enter your email first')
    if (!vendorId) return Alert.alert('Error', 'Store not ready yet')
    setSendingOtp(true)
    try {
      setVendorId(vendorId)
      if (branded) {
        const slug = getVendorSlug()
        if (slug) setVendorSlug(slug)
      }
      const res = await authApi.customerSendSignupOtp({ email: email.trim().toLowerCase() })
      setOtpSent(true)
      const hint = res?.dev_hint ? `\n\nDev hint: ${res.dev_hint}` : ''
      Alert.alert('OTP sent', `Check your email for the code.${hint}`)
    } catch (err: any) {
      Alert.alert('Failed', apiErrorMessage(err, 'Could not send OTP'))
    } finally {
      setSendingOtp(false)
    }
  }

  const handleRegister = async () => {
    if (!fullName || !email || !password || !vendorId || !otpCode) {
      return Alert.alert('Error', 'Please fill in all fields and enter OTP')
    }
    if (password.length < 8) {
      return Alert.alert('Error', 'Password must be at least 8 characters')
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      return Alert.alert('Error', 'Enter the 6-digit OTP sent to your email')
    }

    setLoading(true)
    try {
      setVendorId(vendorId)
      if (branded) {
        const slug = getVendorSlug()
        if (slug) setVendorSlug(slug)
      }
      await authApi.customerRegister({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        otp_code: otpCode.trim(),
      })
      Alert.alert('Success', 'Account created! Please login.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert('Registration Failed', apiErrorMessage(err, 'Something went wrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>
          {branded && storeLabel
            ? `Register for ${storeLabel}`
            : 'Register as a customer'}
        </Text>

        {!branded && (
          <TextInput
            placeholder="Vendor ID"
            value={vendorId}
            onChangeText={setVendorIdInput}
            style={styles.input}
          />
        )}
        {branded && !!storeLabel && (
          <View style={styles.connected}>
            <Text style={styles.connectedText}>Store: {storeLabel}</Text>
          </View>
        )}

        <TextInput
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Password (min 8 chars)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <View style={styles.otpRow}>
          <TextInput
            placeholder="OTP code"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <TouchableOpacity
            onPress={sendOtp}
            disabled={sendingOtp || !email.trim() || !vendorId}
            style={[styles.otpBtn, { opacity: sendingOtp || !email.trim() || !vendorId ? 0.5 : 1 }]}
          >
            {sendingOtp ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.otpBtnText}>{otpSent ? 'Resend' : 'Send OTP'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading || !vendorId}
          style={[styles.submit, { opacity: loading || !vendorId ? 0.7 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>Create account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: BRAND.textMuted, fontSize: 14 }}>
            Already have an account?{' '}
            <Text style={{ color: BRAND.primary, fontWeight: '700' }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
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
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  otpBtn: {
    backgroundColor: BRAND.primaryDark,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
  },
  otpBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  connected: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: BRAND.primarySoft,
    borderRadius: 12,
  },
  connectedText: { color: '#166534', fontWeight: '600', fontSize: 13 },
  submit: {
    backgroundColor: BRAND.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
})
