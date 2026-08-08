import { TouchableOpacity, Platform } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '../../utils/theme'

function HeaderBack({ fallback }: { fallback: string }) {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) {
          router.back()
        } else {
          router.replace(fallback as any)
        }
      }}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={{
        marginLeft: Platform.OS === 'ios' ? -4 : 0,
        paddingHorizontal: 4,
        paddingVertical: 4,
      }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={28} color={BRAND.text} />
    </TouchableOpacity>
  )
}

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: BRAND.card },
        headerTintColor: BRAND.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerBackVisible: false,
        contentStyle: { backgroundColor: BRAND.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="product-detail"
        options={{
          title: 'Product',
          headerLeft: () => <HeaderBack fallback="/customer-screens/(tabs)/browse" />,
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          title: 'Checkout',
          headerLeft: () => <HeaderBack fallback="/customer-screens/(tabs)/cart" />,
        }}
      />
      <Stack.Screen
        name="upi-payment"
        options={{
          title: 'UPI Payment',
          headerLeft: () => <HeaderBack fallback="/customer-screens/(tabs)/cart" />,
        }}
      />
      <Stack.Screen
        name="order-success"
        options={{ title: 'Order placed', headerLeft: () => null }}
      />
      <Stack.Screen
        name="order-detail"
        options={{
          title: 'Order Detail',
          headerLeft: () => <HeaderBack fallback="/customer-screens/(tabs)/orders" />,
        }}
      />
    </Stack>
  )
}
