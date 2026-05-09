import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { vendorApi } from '../../api/vendor'
import { useAuthStore } from '../../stores/authStore'
import { formatCurrency } from '../../lib/utils'
import type { OrderStats, Vendor } from '../../types'

export default function VendorDashboard() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
    try {
      const [s, v] = await Promise.all([vendorApi.getOrderStats(), vendorApi.getMyVendor()])
      setStats(s)
      setVendor(v)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const navItems = [
    { label: 'Orders', route: '/vendor-screens/orders', color: '#3b82f6' },
    { label: 'Products', route: '/vendor-screens/products', color: '#10b981' },
    { label: 'Customers', route: '/vendor-screens/customers', color: '#8b5cf6' },
    { label: 'Settings', route: '/vendor-screens/settings', color: '#f59e0b' },
  ]

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData() }} />}
        contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Welcome, {user?.full_name}!</Text>
        <Text style={{ color: '#6b7280', marginBottom: 24 }}>{vendor?.display_name}</Text>

        {/* Stats */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Revenue', value: stats ? formatCurrency(stats.total_revenue) : '-', bg: '#dcfce7' },
            { label: 'Orders', value: String(stats?.total_orders ?? 0), bg: '#dbeafe' },
            { label: 'Pending', value: String(stats?.pending_orders ?? 0), bg: '#fef9c3' },
            { label: 'Today', value: String(stats?.today_orders ?? 0), bg: '#f3e8ff' },
          ].map((s) => (
            <View key={s.label} style={{ width: '47%', backgroundColor: s.bg, borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.label}</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Quick Nav */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Quick Actions</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {navItems.map((item) => (
            <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)}
              style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color + '20', marginBottom: 8, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: item.color }}>{item.label[0]}</Text>
              </View>
              <Text style={{ fontWeight: '600' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => { logout(); router.replace('/auth-screens/login') }}
          style={{ backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#ef4444', fontWeight: '600' }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
