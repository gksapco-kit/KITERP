import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { isBrandedApp, loadVendorBranding, type VendorBranding } from '../utils/vendorConfig'
import { setVendorSlug } from '../api/client'
import { BRAND } from '../utils/theme'

export default function Index() {
  const router = useRouter()
  const { isAuthenticated, role } = useAuthStore()
  const [branding, setBranding] = useState<VendorBranding | null>(null)

  useEffect(() => {
    loadVendorBranding().then((b) => {
      setBranding(b)
      if (b.vendorSlug) {
        setVendorSlug(b.vendorSlug)
      }
    })
  }, [])

  useEffect(() => {
    if (!branding) return

    const timer = setTimeout(() => {
      if (role === 'vendor' && isAuthenticated) {
        router.replace('/vendor-screens/dashboard')
        return
      }

      // Branded customer apps: native store UI (website stays unchanged)
      if (isBrandedApp()) {
        router.replace('/customer-screens/home')
        return
      }

      if (!isAuthenticated) {
        router.replace('/auth-screens/login')
      } else if (role === 'customer') {
        router.replace('/customer-screens/home')
      } else {
        router.replace('/auth-screens/login')
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [isAuthenticated, role, branding])

  const bgColor = branding?.primaryColor || BRAND.primary
  const appName = branding?.name || 'KITERP'

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: bgColor }}>
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 16 }}>{appName}</Text>
      <ActivityIndicator size="large" color="white" />
    </View>
  )
}
