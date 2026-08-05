import { Stack } from 'expo-router'

export default function VendorLayout() {
  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard', headerShown: true }} />
      <Stack.Screen name="orders" options={{ title: 'Orders', headerShown: true }} />
      <Stack.Screen name="order-detail" options={{ title: 'Order Detail', headerShown: true }} />
      <Stack.Screen name="products" options={{ title: 'Products', headerShown: true }} />
      <Stack.Screen name="customers" options={{ title: 'Customers', headerShown: true }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', headerShown: true }} />
      <Stack.Screen name="attendance" options={{ title: 'My Attendance', headerShown: true }} />
    </Stack>
  )
}
