import { Stack } from 'expo-router'
import { BRAND } from '../../utils/theme'

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: BRAND.card },
        headerTintColor: BRAND.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: BRAND.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product-detail" options={{ title: 'Product' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="order-detail" options={{ title: 'Order Detail' }} />
    </Stack>
  )
}
