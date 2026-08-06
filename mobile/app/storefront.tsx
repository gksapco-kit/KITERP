import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getBrandedStorefrontUrl } from '../utils/storefrontUrl'
import { getVendorSlug } from '../utils/vendorConfig'

// react-native-webview ships no web implementation, so keep it out of the web bundle.
const NativeWebView =
  Platform.OS === 'web' ? null : require('react-native-webview').WebView

/**
 * Expo web cannot iframe kiterp.com (X-Frame-Options: SAMEORIGIN),
 * so send the browser straight to the real storefront.
 */
function StorefrontWebRedirect({ uri }: { uri: string }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && uri) {
      window.location.replace(uri)
    }
  }, [uri])

  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.hint}>Opening store…</Text>
      <Text style={styles.errorBody}>{uri}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(uri)} style={styles.openBtn}>
        <Text style={styles.openBtnText}>Open store</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function StorefrontScreen() {
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadDone = useRef(false)
  const webViewRef = useRef<{ injectJavaScript?: (js: string) => void } | null>(null)
  const uri = useMemo(() => getBrandedStorefrontUrl(), [])
  const slug = getVendorSlug()

  const finishInitialLoad = useCallback(() => {
    initialLoadDone.current = true
    setInitialLoading(false)
  }, [])

  if (Platform.OS === 'web' || !NativeWebView) {
    return (
      <SafeAreaView style={styles.root}>
        <StorefrontWebRedirect uri={uri} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.fill}>
        {initialLoading && !error && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.hint}>Loading {slug || 'store'}…</Text>
          </View>
        )}

        {error ? (
          <View style={styles.overlay}>
            <Text style={styles.errorTitle}>Could not load store</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorBody}>{uri}</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(uri)}
              style={styles.openBtn}
            >
              <Text style={styles.openBtnText}>Open in browser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <NativeWebView
            ref={webViewRef}
            source={{ uri }}
            style={styles.fill}
            originWhitelist={['http://*', 'https://*']}
            // Only clear the spinner after the first document load.
            // SPA navigations (Products/Cart) fire onLoadStart again on Android
            // but often never fire onLoadEnd — re-showing the overlay blocked the UI.
            onLoadStart={() => {
              if (!initialLoadDone.current) {
                setError(null)
              }
            }}
            onLoadEnd={finishInitialLoad}
            onLoadProgress={({ nativeEvent }: { nativeEvent: { progress: number } }) => {
              if (!initialLoadDone.current && nativeEvent.progress >= 0.9) {
                finishInitialLoad()
              }
            }}
            onError={(e: { nativeEvent: { description?: string } }) => {
              finishInitialLoad()
              setError(e.nativeEvent.description || 'Network error')
            }}
            onHttpError={() => {
              // Don't trap the UI on HTTP errors after first paint.
              finishInitialLoad()
            }}
            // Keep target=_blank / window.open inside this WebView instead of dropping them.
            setSupportMultipleWindows
            onOpenWindow={(e: { nativeEvent: { targetUrl?: string } }) => {
              const targetUrl = e.nativeEvent.targetUrl
              if (targetUrl && webViewRef.current?.injectJavaScript) {
                const safe = JSON.stringify(targetUrl)
                webViewRef.current.injectJavaScript(
                  `window.location.href = ${safe}; true;`,
                )
              }
            }}
            startInLoadingState={false}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures
            // Allow mixed content / cookies used by the live storefront SPA.
            mixedContentMode="always"
            allowsInlineMediaPlayback
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  fill: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
    gap: 8,
  },
  hint: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  errorBody: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  openBtn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  openBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
