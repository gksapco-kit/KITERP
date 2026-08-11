import { useEffect, useState } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../../stores/authStore'
import { useCartStore } from '../../../stores/cartStore'
import { BRAND } from '../../../utils/theme'
import { isSrMarketingStore, loadVendorBranding } from '../../../utils/vendorConfig'

export default function CustomerTabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const vendorInfo = useAuthStore((s) => s.vendorInfo)
  const vendorSlug = useAuthStore((s) => s.vendorSlug)
  const itemCount = useCartStore((s) => s.itemCount)
  const loadCart = useCartStore((s) => s.loadCart)
  const [srStore, setSrStore] = useState(() =>
    isSrMarketingStore(vendorInfo?.slug || vendorSlug),
  )

  useEffect(() => {
    void loadCart(isAuthenticated).catch(() => undefined)
  }, [isAuthenticated, loadCart])

  useEffect(() => {
    let alive = true
    loadVendorBranding()
      .then((b) => {
        if (!alive) return
        setSrStore(isSrMarketingStore(b.vendorSlug || vendorInfo?.slug || vendorSlug))
      })
      .catch(() => {
        if (!alive) return
        setSrStore(isSrMarketingStore(vendorInfo?.slug || vendorSlug))
      })
    return () => {
      alive = false
    }
  }, [vendorInfo?.slug, vendorSlug])

  const badge = itemCount > 0 ? (itemCount > 99 ? '99+' : itemCount) : undefined

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.primary,
        tabBarInactiveTintColor: BRAND.textMuted,
        tabBarStyle: {
          backgroundColor: BRAND.card,
          borderTopColor: BRAND.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: BRAND.primary,
            color: '#fff',
            fontSize: 11,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag-handle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rental"
        options={
          srStore
            ? {
                title: 'Rental',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="cube-outline" size={size} color={color} />
                ),
              }
            : {
                href: null,
              }
        }
      />
      <Tabs.Screen
        name="orders"
        options={
          srStore
            ? {
                href: null,
              }
            : {
                title: 'Orders',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="receipt-outline" size={size} color={color} />
                ),
              }
        }
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
