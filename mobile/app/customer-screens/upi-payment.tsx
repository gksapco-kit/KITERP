import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import { storeApi } from '../../api/store'
import { apiErrorMessage } from '../../api/auth'
import { getVendorSlug } from '../../utils/vendorConfig'
import { formatCurrency } from '../../lib/utils'
import { mediaUrl } from '../../lib/mediaUrl'
import { resolveUpiQrSrc } from '../../lib/upiQr'
import { useCartStore } from '../../stores/cartStore'
import { BRAND } from '../../utils/theme'
import type { ManualUpiConfig, Order } from '../../types'

export default function UpiPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const router = useRouter()
  const clearLocal = useCartStore((s) => s.clearLocal)

  const [order, setOrder] = useState<Order | null>(null)
  const [manualUpi, setManualUpi] = useState<ManualUpiConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [utr, setUtr] = useState('')
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [o, upi] = await Promise.all([
          storeApi.getOrder(orderId),
          storeApi.getManualUpi(getVendorSlug() || 'rainbow-nursery').catch(() => null),
        ])
        if (cancelled) return
        setOrder(o)
        setManualUpi(upi)

        if (
          o.payment_proof?.status === 'submitted' ||
          o.payment_status === 'paid' ||
          o.payment_status === 'pending_verification'
        ) {
          clearLocal()
          router.replace({
            pathname: '/customer-screens/order-success',
            params: { orderId: o.id, orderNumber: o.order_number },
          })
        }
      } catch (err: any) {
        Alert.alert('Error', apiErrorMessage(err, 'Could not load payment details'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderId])

  const qrSrc = useMemo(() => {
    if (!order || !manualUpi) return null
    return resolveUpiQrSrc({
      qr_code_url: manualUpi.qr_code_url,
      upi_id: manualUpi.upi_id,
      amountRupees: Number(order.total) || 0,
      business_name: manualUpi.business_name,
    })
  }, [order, manualUpi])

  const copyUpi = async () => {
    if (!manualUpi?.upi_id) return
    try {
      await Clipboard.setStringAsync(manualUpi.upi_id)
      Alert.alert('Copied', 'UPI ID copied to clipboard')
    } catch {
      Alert.alert('UPI ID', manualUpi.upi_id)
    }
  }

  const pickScreenshot = async () => {
    if (!orderId) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload payment screenshot.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setScreenshotUri(asset.uri)
    setUploading(true)
    try {
      const name = asset.fileName || `upi-proof-${Date.now()}.jpg`
      const type = asset.mimeType || 'image/jpeg'
      const uploaded = await storeApi.uploadOrderMedia(orderId, {
        uri: asset.uri,
        name,
        type,
      })
      setScreenshotUrl(uploaded.url)
    } catch (err: any) {
      setScreenshotUri(null)
      Alert.alert('Upload failed', apiErrorMessage(err, 'Try a JPG/PNG under 5 MB'))
    } finally {
      setUploading(false)
    }
  }

  const submitProof = async () => {
    if (!orderId) return
    if (!utr.trim() || !screenshotUrl) {
      Alert.alert('Required', 'Enter UTR / transaction ID and upload a payment screenshot.')
      return
    }
    setSubmitting(true)
    try {
      await storeApi.submitPaymentProof(orderId, {
        utr: utr.trim(),
        screenshot_url: screenshotUrl,
      })
      clearLocal()
      router.replace({
        pathname: '/customer-screens/order-success',
        params: {
          orderId,
          orderNumber: order?.order_number || '',
        },
      })
    } catch (err: any) {
      Alert.alert('Submit failed', apiErrorMessage(err, 'Could not submit payment proof'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Complete UPI payment</Text>
        <Text style={styles.sub}>
          Order <Text style={styles.strong}>{order.order_number}</Text>
          {' · '}Pay <Text style={styles.strong}>{formatCurrency(order.total)}</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {manualUpi?.business_name || 'Pay via UPI'}
          </Text>
          {qrSrc ? (
            <>
              <Image source={{ uri: mediaUrl(qrSrc) || qrSrc }} style={styles.qr} />
              <Text style={styles.hint}>Scan with GPay, PhonePe, Paytm, or any UPI app</Text>
            </>
          ) : (
            <Text style={styles.hint}>
              UPI QR is not configured yet. Ask the store to add their UPI details.
            </Text>
          )}
          {!!manualUpi?.upi_id && (
            <TouchableOpacity style={styles.upiRow} onPress={copyUpi}>
              <Text style={styles.upiLabel}>UPI ID</Text>
              <Text style={styles.upiId}>{manualUpi.upi_id}</Text>
              <Ionicons name="copy-outline" size={16} color={BRAND.primaryDark} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>UTR / Transaction ID</Text>
          <TextInput
            value={utr}
            onChangeText={setUtr}
            placeholder="e.g. 123456789012"
            autoCapitalize="characters"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Payment screenshot</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickScreenshot}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={BRAND.primaryDark} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={BRAND.primaryDark} />
                <Text style={styles.uploadText}>
                  {screenshotUrl ? 'Change screenshot' : 'Upload screenshot'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {!!screenshotUri && (
            <Image source={{ uri: screenshotUri }} style={styles.preview} />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, { opacity: submitting || uploading ? 0.7 : 1 }]}
          disabled={submitting || uploading}
          onPress={submitProof}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>I have paid — submit proof</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.text },
  sub: { marginTop: 6, color: BRAND.textMuted, fontSize: 14 },
  strong: { fontWeight: '800', color: BRAND.text },
  card: {
    marginTop: 16,
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
  },
  cardTitle: { fontWeight: '800', fontSize: 16, color: BRAND.text, marginBottom: 12 },
  qr: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  hint: {
    textAlign: 'center',
    color: BRAND.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
  upiRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  upiLabel: { color: BRAND.textMuted, fontSize: 12 },
  upiId: { flex: 1, fontWeight: '700', color: BRAND.text },
  label: { fontWeight: '700', color: BRAND.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BRAND.primary,
    backgroundColor: BRAND.primarySoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  uploadText: { color: BRAND.primaryDark, fontWeight: '700' },
  preview: {
    marginTop: 12,
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#EEF2F0',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
  },
  cta: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
