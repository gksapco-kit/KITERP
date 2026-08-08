import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../../stores/authStore'
import { isBrandedApp } from '../../../utils/vendorConfig'
import { formatCurrency } from '../../../lib/utils'
import { BRAND } from '../../../utils/theme'

export default function CustomerAccount() {
  const router = useRouter()
  const { customer, vendorInfo, isAuthenticated, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    if (isBrandedApp()) {
      router.replace('/customer-screens/home')
    } else {
      router.replace('/auth-screens/login')
    }
  }

  if (!isAuthenticated || !customer) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={32} color={BRAND.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your account</Text>
          <Text style={styles.emptySub}>
            Sign in to manage orders and checkout faster
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/auth-screens/login')}
          >
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/auth-screens/register')}
          >
            <Text style={styles.secondaryBtnText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.pageTitle}>Account</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLetter}>
              {(customer.full_name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{customer.full_name}</Text>
          <Text style={styles.meta}>{customer.email}</Text>
          {!!customer.phone && <Text style={styles.meta}>{customer.phone}</Text>}
          {!!vendorInfo?.display_name && (
            <View style={styles.storePill}>
              <Ionicons name="storefront-outline" size={14} color={BRAND.primaryDark} />
              <Text style={styles.storePillText}>{vendorInfo.display_name}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: BRAND.primarySoft }]}>
            <Text style={[styles.statValue, { color: BRAND.primaryDark }]}>
              {customer.total_orders || 0}
            </Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.statValue, { color: '#059669' }]}>
              {formatCurrency(customer.total_spent || 0)}
            </Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/customer-screens/orders')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="receipt-outline" size={20} color={BRAND.primary} />
            <Text style={styles.menuText}>My orders</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={BRAND.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/customer-screens/cart')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="bag-handle-outline" size={20} color={BRAND.primary} />
            <Text style={styles.menuText}>Cart</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={BRAND.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: BRAND.text, marginBottom: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: BRAND.text },
  emptySub: { color: BRAND.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryBtnText: { color: BRAND.primaryDark, fontWeight: '700' },
  profileCard: {
    backgroundColor: BRAND.card,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: BRAND.text },
  meta: { color: BRAND.textMuted, marginTop: 2 },
  storePill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  storePillText: { color: BRAND.primaryDark, fontWeight: '600', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, color: BRAND.textMuted, marginTop: 4 },
  menuItem: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontWeight: '600', color: BRAND.text, fontSize: 15 },
  logoutBtn: {
    backgroundColor: BRAND.dangerSoft,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: { color: BRAND.danger, fontWeight: '700' },
})
