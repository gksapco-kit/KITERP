import { Stack } from 'expo-router'

export default function CustomerLayout() {
  return (
    <Stack>
      <Stack.Screen name="home" options={{ title: 'Home', headerShown: true }} />
      <Stack.Screen name="browse" options={{ title: 'Browse', headerShown: true }} />
      <Stack.Screen name="product-detail" options={{ title: 'Product', headerShown: true }} />
      <Stack.Screen name="cart" options={{ title: 'Cart', headerShown: true }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout', headerShown: true }} />
      <Stack.Screen name="orders" options={{ title: 'My Orders', headerShown: true }} />
      <Stack.Screen name="order-detail" options={{ title: 'Order Detail', headerShown: true }} />
      <Stack.Screen name="account" options={{ title: 'Account', headerShown: true }} />
    </Stack>
  )
}
