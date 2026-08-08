import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../../stores/authStore'
import { useCartStore } from '../../../stores/cartStore'
import { isBrandedApp } from '../../../utils/vendorConfig'
import { formatCurrency } from '../../../lib/utils'
import { BRAND, withAlpha } from '../../../utils/theme'

type MenuItem = {
  key: string
  title: string
  subtitle: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  badge?: string | number
}

export default function CustomerAccount() {
  const router = useRouter()
  const { customer, vendorInfo, isAuthenticated, logout } = useAuthStore()
  const cartCount = useCartStore((s) => s.itemCount)

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
        <View style={styles.orbTop} pointerEvents="none" />
        <View style={styles.orbBottom} pointerEvents="none" />
        <ScrollView contentContainerStyle={styles.guestScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Account</Text>
          <View style={styles.guestCard}>
            <View style={styles.guestIcon}>
              <Ionicons name="person-outline" size={30} color={BRAND.primaryDark} />
            </View>
            <Text style={styles.guestTitle}>Welcome</Text>
            <Text style={styles.guestSub}>
              Sign in to track orders, save your cart, and checkout faster.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/auth-screens/login')}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryBtnText}>Sign in</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push('/auth-screens/register')}
              activeOpacity={0.9}
            >
              <Text style={styles.secondaryBtnText}>Create account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestBrowse}
              onPress={() => router.push('/customer-screens/browse')}
            >
              <Text style={styles.guestBrowseText}>Continue browsing</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const initial = (customer.full_name || customer.email || 'C').charAt(0).toUpperCase()
  const storeName = vendorInfo?.display_name || 'Store'

  const menu: MenuItem[] = [
    {
      key: 'orders',
      title: 'My orders',
      subtitle: 'Track and review purchases',
      icon: 'receipt-outline',
      onPress: () => router.push('/customer-screens/orders'),
      badge: customer.total_orders || undefined,
    },
    {
      key: 'cart',
      title: 'Cart',
      subtitle: cartCount > 0 ? `${cartCount} items ready` : 'Your bag is empty',
      icon: 'bag-handle-outline',
      onPress: () => router.push('/customer-screens/cart'),
      badge: cartCount > 0 ? cartCount : undefined,
    },
    {
      key: 'shop',
      title: 'Continue shopping',
      subtitle: `Browse ${storeName}`,
      icon: 'leaf-outline',
      onPress: () => router.push('/customer-screens/browse'),
    },
  ]

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.orbTop} pointerEvents="none" />
      <View style={styles.orbBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Account</Text>
        <Text style={styles.pageSub}>Manage your profile and activity</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {customer.full_name || 'Customer'}
              </Text>
              {!!customer.email && (
                <View style={styles.metaRow}>
                  <Ionicons name="mail-outline" size={13} color={BRAND.textMuted} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {customer.email}
                  </Text>
                </View>
              )}
              {!!customer.phone && (
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={13} color={BRAND.textMuted} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {customer.phone}
                  </Text>
                </View>
              )}
              <View style={styles.storePill}>
                <Ionicons name="storefront-outline" size={13} color={BRAND.primaryDark} />
                <Text style={styles.storePillText}>{storeName}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(BRAND.primary, 0.18) }]}>
              <Ionicons name="receipt-outline" size={16} color={BRAND.primaryDark} />
            </View>
            <Text style={styles.statValue}>{customer.total_orders || 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha('#059669', 0.14) }]}>
              <Ionicons name="wallet-outline" size={16} color="#059669" />
            </View>
            <Text style={[styles.statValue, { color: '#059669' }]} numberOfLines={1}>
              {formatCurrency(customer.total_spent || 0)}
            </Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <View style={styles.menuCard}>
          {menu.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, index < menu.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={20} color={BRAND.primaryDark} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuText}>{item.title}</Text>
                <Text style={styles.menuSub}>{item.subtitle}</Text>
              </View>
              {item.badge != null && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={BRAND.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={BRAND.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  orbTop: {
    position: 'absolute',
    top: -90,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: withAlpha(BRAND.primary, 0.14),
  },
  orbBottom: {
    position: 'absolute',
    bottom: 80,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: withAlpha(BRAND.primaryDark, 0.08),
  },
  scroll: { padding: 20, paddingBottom: 36 },
  guestScroll: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: BRAND.text },
  pageSub: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 14,
    color: BRAND.textMuted,
  },
  guestCard: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  guestIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  guestTitle: { fontSize: 22, fontWeight: '800', color: BRAND.text },
  guestSub: {
    color: BRAND.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 20,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: 16,
    minWidth: 220,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 14,
    minWidth: 220,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.bg,
  },
  secondaryBtnText: { color: BRAND.primaryDark, fontWeight: '800' },
  guestBrowse: { marginTop: 16, paddingVertical: 8 },
  guestBrowseText: { color: BRAND.textMuted, fontWeight: '600', fontSize: 13 },
  profileCard: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '800' },
  profileInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 20, fontWeight: '800', color: BRAND.text, marginBottom: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  meta: { color: BRAND.textMuted, fontSize: 13, flexShrink: 1 },
  storePill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BRAND.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  storePillText: { color: BRAND.primaryDark, fontWeight: '700', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: BRAND.primaryDark },
  statLabel: { fontSize: 12, color: BRAND.textMuted, marginTop: 2, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  menuCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuText: { fontWeight: '700', color: BRAND.text, fontSize: 15 },
  menuSub: { marginTop: 2, fontSize: 12, color: BRAND.textMuted },
  menuBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  logoutBtn: {
    backgroundColor: BRAND.dangerSoft,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: BRAND.danger, fontWeight: '800', fontSize: 15 },
})
