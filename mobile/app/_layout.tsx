import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="storefront" options={{ title: 'Store' }} />
          <Stack.Screen name="auth-screens" />
          <Stack.Screen name="vendor-screens" />
          <Stack.Screen name="customer-screens" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
