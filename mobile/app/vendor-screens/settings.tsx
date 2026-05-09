import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { vendorApi } from '../../api/vendor'
import { useAuthStore } from '../../stores/authStore'
import type { Vendor } from '../../types'

export default function VendorSettings() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { vendorApi.getMyVendor().then(setVendor).catch(console.error).finally(() => setLoading(false)) }, [])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  const InfoRow = ({ label, value }: { label: string; value?: string }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f3f4f6' }}>
      <Text style={{ color: '#6b7280', fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '500', fontSize: 14 }}>{value || '-'}</Text>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 12 }}>Store Information</Text>
          <InfoRow label="Business Name" value={vendor?.business_name} />
          <InfoRow label="Display Name" value={vendor?.display_name} />
          <InfoRow label="Slug" value={vendor?.slug} />
          <InfoRow label="Status" value={vendor?.status} />
          <InfoRow label="Email" value={vendor?.primary_email} />
          <InfoRow label="Phone" value={vendor?.primary_phone} />
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 12 }}>Account</Text>
          <InfoRow label="Name" value={user?.full_name} />
          <InfoRow label="Email" value={user?.email} />
        </View>

        <TouchableOpacity onPress={() => { logout(); router.replace('/auth-screens/login') }}
          style={{ backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 16 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
