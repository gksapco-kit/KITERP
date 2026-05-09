import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { formatCurrency } from '../../lib/utils'

export default function CustomerAccount() {
  const router = useRouter()
  const { customer, logout } = useAuthStore()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 28 }}>👤</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{customer?.full_name}</Text>
          <Text style={{ color: '#6b7280', marginTop: 2 }}>{customer?.email}</Text>
          {customer?.phone && <Text style={{ color: '#6b7280', marginTop: 2 }}>{customer.phone}</Text>}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, backgroundColor: '#dbeafe', borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2563eb' }}>{customer?.total_orders || 0}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Orders</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#dcfce7', borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>{customer ? formatCurrency(customer.total_spent) : '-'}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Spent</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.push('/customer-screens/orders')}
          style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '600' }}>My Orders</Text>
          <Text style={{ color: '#6b7280' }}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { logout(); router.replace('/auth-screens/login') }}
          style={{ backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ color: '#ef4444', fontWeight: '600' }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
