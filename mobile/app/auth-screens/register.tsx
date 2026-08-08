import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { authApi, apiErrorMessage } from '../../api/auth'
import { resolveVendorBySlug, setVendorId, setVendorSlug } from '../../api/client'
import { getVendorSlug, isBrandedApp, loadVendorBranding } from '../../utils/vendorConfig'
import { BRAND, withAlpha } from '../../utils/theme'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ContactMode = 'email' | 'phone'

/** Match backend normalize_e164 for India-first signup. */
function toE164Phone(raw: string): string {
  const cleaned = (raw || '').replace(/[\s\-().]/g, '').trim()
  if (!cleaned) return ''
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`
  if (cleaned.startsWith('+')) return cleaned
  return `+${cleaned.replace(/^\+/, '')}`
}

function isValidPhone(raw: string): boolean {
  const e164 = toE164Phone(raw)
  const digits = e164.replace(/\D/g, '')
  return e164.startsWith('+') && digits.length >= 10 && digits.length <= 15
}

function Field({
  label,
  icon,
  children,
  hint,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  children: ReactNode
  hint?: string
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Ionicons name={icon} size={18} color={BRAND.textMuted} style={styles.fieldIcon} />
        {children}
      </View>
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  )
}

export default function RegisterScreen() {
  const router = useRouter()
  const branded = isBrandedApp()
  const [fullName, setFullName] = useState('')
  const [contactMode, setContactMode] = useState<ContactMode>('phone')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpChannel, setOtpChannel] = useState<'email' | 'phone' | null>(null)
  /** Exact contact used when OTP was sent — must match register payload. */
  const [lockedContact, setLockedContact] = useState<string>('')
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

  const emailOk = EMAIL_RE.test(email.trim())
  const phoneE164 = toE164Phone(phone)
  const phoneOk = isValidPhone(phone)
  const contactValid = contactMode === 'email' ? emailOk : phoneOk
  const otpReady = /^\d{6}$/.test(otpCode.trim())
  const canCreate = otpSent && otpReady && !!lockedContact

  const contactPreview = useMemo(() => {
    if (contactMode === 'email') return email.trim().toLowerCase()
    return phoneE164 || phone.trim()
  }, [contactMode, email, phone, phoneE164])

  const applyVendorHeaders = () => {
    setVendorId(vendorId)
    if (branded) {
      const slug = getVendorSlug()
      if (slug) setVendorSlug(slug)
    }
  }

  const resetOtpState = () => {
    setOtpSent(false)
    setOtpChannel(null)
    setOtpCode('')
    setLockedContact('')
  }

  const sendOtp = async () => {
    if (!fullName.trim()) {
      return Alert.alert('Missing name', 'Enter your full name first')
    }
    if (password.length < 8) {
      return Alert.alert('Password', 'Password must be at least 8 characters')
    }
    if (!contactValid) {
      return Alert.alert(
        'Check contact',
        contactMode === 'email'
          ? 'Enter a valid email address'
          : 'Enter a valid phone number (e.g. 9876543210 or +919876543210)',
      )
    }
    if (!vendorId) return Alert.alert('Error', 'Store not ready yet')

    setSendingOtp(true)
    try {
      applyVendorHeaders()
      const contact =
        contactMode === 'email' ? email.trim().toLowerCase() : phoneE164
      const payload =
        contactMode === 'email' ? { email: contact } : { phone: contact }
      const res = await authApi.customerSendSignupOtp(payload)
      setLockedContact(contact)
      setOtpSent(true)
      setOtpChannel(contactMode)
      setOtpCode('')
      const where = res?.to || contact
      const hint = res?.dev_hint ? `\n\nDev code: ${res.dev_hint}` : ''
      Alert.alert(
        'OTP sent',
        contactMode === 'email'
          ? `Check your email (${where}) for the 6-digit code.${hint}`
          : `Check your phone (${where}) for the SMS code.${hint}`,
      )
    } catch (err: any) {
      resetOtpState()
      Alert.alert('Failed', apiErrorMessage(err, 'Could not send OTP'))
    } finally {
      setSendingOtp(false)
    }
  }

  const handleRegister = async () => {
    if (!fullName.trim()) {
      return Alert.alert('Error', 'Enter your full name')
    }
    if (password.length < 8) {
      return Alert.alert('Error', 'Password must be at least 8 characters')
    }
    if (!vendorId) {
      return Alert.alert('Error', 'Store not ready yet')
    }
    if (!otpSent || !lockedContact) {
      return Alert.alert('Verify contact', 'Tap Send OTP first, then enter the code')
    }
    if (!otpReady) {
      return Alert.alert('Enter OTP', 'Type the 6-digit code from SMS/email')
    }

    setLoading(true)
    try {
      applyVendorHeaders()
      const payload =
        otpChannel === 'email'
          ? {
              full_name: fullName.trim(),
              email: lockedContact,
              password,
              otp_code: otpCode.trim(),
            }
          : {
              full_name: fullName.trim(),
              phone: lockedContact,
              password,
              otp_code: otpCode.trim(),
            }

      await authApi.customerRegister(payload)
      Alert.alert('Success', 'Account created! Please sign in.', [
        { text: 'OK', onPress: () => router.replace('/auth-screens/login') },
      ])
    } catch (err: any) {
      const msg = apiErrorMessage(err, 'Something went wrong')
      if (/invalid|expired|otp/i.test(msg)) {
        Alert.alert('OTP issue', `${msg}\n\nRequest a new code with Resend, then try again.`, [
          { text: 'OK' },
          {
            text: 'Resend OTP',
            onPress: () => {
              void sendOtp()
            },
          },
        ])
      } else {
        Alert.alert('Registration Failed', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else if (branded) router.replace('/auth-screens/login')
    else router.replace('/')
  }

  const switchMode = (mode: ContactMode) => {
    setContactMode(mode)
    resetOtpState()
  }

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
          <Text style={styles.topTitle}>Create account</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="leaf" size={26} color={BRAND.primaryDark} />
            </View>
            <Text style={styles.heroTitle}>Join {storeLabel || 'the store'}</Text>
            <Text style={styles.heroSub}>
              Create your account to track orders and checkout faster.
            </Text>
          </View>

          {branded && !!storeLabel && (
            <View style={styles.storePill}>
              <Ionicons name="storefront-outline" size={16} color={BRAND.primaryDark} />
              <Text style={styles.storePillText}>{storeLabel}</Text>
            </View>
          )}

          {!branded && (
            <Field label="Vendor ID" icon="key-outline">
              <TextInput
                placeholder="Vendor ID"
                placeholderTextColor={BRAND.textMuted}
                value={vendorId}
                onChangeText={setVendorIdInput}
                style={styles.input}
              />
            </Field>
          )}

          <View style={styles.card}>
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

            <Text style={styles.sectionLabel}>Contact for OTP</Text>
            <View style={styles.segment}>
              {([
                { key: 'email', label: 'Email', icon: 'mail-outline' },
                { key: 'phone', label: 'Phone', icon: 'call-outline' },
              ] as const).map((opt) => {
                const active = contactMode === opt.key
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => switchMode(opt.key)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? '#fff' : BRAND.textMuted}
                    />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {contactMode === 'email' ? (
              <Field label="Email" icon="mail-outline" hint="We’ll send a 6-digit code here">
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor={BRAND.textMuted}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t)
                    resetOtpState()
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </Field>
            ) : (
              <Field
                label="Phone"
                icon="call-outline"
                hint="10-digit Indian mobile, or +91…"
              >
                <TextInput
                  placeholder="9876543210"
                  placeholderTextColor={BRAND.textMuted}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t)
                    resetOtpState()
                  }}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </Field>
            )}

            <Field label="Password" icon="lock-closed-outline" hint="Minimum 8 characters">
              <TextInput
                placeholder="Create a password"
                placeholderTextColor={BRAND.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={[styles.input, { paddingRight: 8 }]}
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
            </Field>
          </View>

          <View style={[styles.card, styles.verifyCard]}>
            <View style={styles.verifyHeader}>
              <View style={styles.verifyIcon}>
                <Ionicons name="shield-checkmark-outline" size={18} color={BRAND.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyTitle}>Verify contact</Text>
                <Text style={styles.verifySub}>
                  {otpSent && otpChannel
                    ? `Code sent via ${otpChannel === 'email' ? 'email' : 'SMS'} to ${contactPreview}`
                    : 'Send a one-time code, then enter it below'}
                </Text>
              </View>
            </View>

            {!otpSent ? (
              <TouchableOpacity
                onPress={sendOtp}
                disabled={sendingOtp || !contactValid || !vendorId}
                style={[
                  styles.sendOtpWide,
                  { opacity: sendingOtp || !contactValid || !vendorId ? 0.5 : 1 },
                ]}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                    <Text style={styles.sendOtpWideText}>Send OTP</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.otpRow}>
                  <View style={[styles.fieldRow, { flex: 1, marginBottom: 0 }]}>
                    <Ionicons
                      name="keypad-outline"
                      size={18}
                      color={BRAND.textMuted}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      placeholder="6-digit OTP"
                      placeholderTextColor={BRAND.textMuted}
                      value={otpCode}
                      onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    onPress={sendOtp}
                    disabled={sendingOtp || !contactValid || !vendorId}
                    style={[
                      styles.otpBtn,
                      { opacity: sendingOtp || !contactValid || !vendorId ? 0.5 : 1 },
                    ]}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.otpBtnText}>Resend</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {otpReady ? (
                  <TouchableOpacity
                    onPress={handleRegister}
                    disabled={loading || !vendorId}
                    style={[styles.submit, { opacity: loading || !vendorId ? 0.7 : 1, marginTop: 14 }]}
                    activeOpacity={0.9}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.submitText}>Verify & create account</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.otpWaiting}>
                    Enter the 6-digit code to unlock account creation
                  </Text>
                )}
              </>
            )}
          </View>

          {!canCreate && otpSent && (
            <Text style={styles.helperNote}>
              Tip: use the latest SMS code. If it fails, tap Resend for a new one.
            </Text>
          )}

          <TouchableOpacity onPress={goBack} style={styles.footerLink}>
            <Text style={styles.footerMuted}>
              Already have an account?{' '}
              <Text style={styles.footerAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
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
    paddingHorizontal: 12,
  },
  storePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
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
  verifyCard: {
    backgroundColor: withAlpha(BRAND.primary, 0.06),
    borderColor: withAlpha(BRAND.primary, 0.22),
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.textMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: BRAND.bg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: BRAND.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.textMuted,
  },
  segmentTextActive: {
    color: '#fff',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 6,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: BRAND.textMuted,
    lineHeight: 15,
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
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  verifyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BRAND.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.text,
  },
  verifySub: {
    marginTop: 2,
    fontSize: 12,
    color: BRAND.textMuted,
  },
  sendOtpWide: {
    backgroundColor: BRAND.primaryDark,
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sendOtpWideText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  otpBtn: {
    backgroundColor: BRAND.primaryDark,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    minWidth: 88,
    alignItems: 'center',
  },
  otpBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  otpWaiting: {
    marginTop: 12,
    fontSize: 12,
    color: BRAND.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
  helperNote: {
    fontSize: 12,
    color: BRAND.textMuted,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 17,
  },
  submit: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
})
