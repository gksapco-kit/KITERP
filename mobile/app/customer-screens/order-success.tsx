import { useEffect, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BRAND, withAlpha } from '../../utils/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const PARTICLE_COUNT = 28

const PARTICLE_COLORS = [
  BRAND.primary,
  BRAND.primaryDark,
  '#FBBF24',
  '#F472B6',
  '#60A5FA',
  '#A78BFA',
  '#34D399',
]

type Particle = {
  x: Animated.Value
  y: Animated.Value
  opacity: Animated.Value
  rotate: Animated.Value
  scale: Animated.Value
  color: string
  size: number
  shape: 'rect' | 'circle'
}

function useParticles(): Particle[] {
  return useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(0),
        rotate: new Animated.Value(0),
        scale: new Animated.Value(0.4),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        size: 6 + (i % 5) * 2,
        shape: i % 3 === 0 ? 'circle' : 'rect',
      })),
    [],
  )
}

export default function OrderSuccessScreen() {
  const { orderId, orderNumber } = useLocalSearchParams<{
    orderId: string
    orderNumber?: string
  }>()
  const router = useRouter()

  const particles = useParticles()
  const ring1 = useRef(new Animated.Value(0)).current
  const ring2 = useRef(new Animated.Value(0)).current
  const checkScale = useRef(new Animated.Value(0)).current
  const checkOpacity = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentY = useRef(new Animated.Value(24)).current
  const glow = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    // Confetti burst from center
    const burst = particles.map((p, i) => {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (i % 4) * 0.2
      const distance = 90 + (i % 7) * 38 + Math.random() * 40
      const dx = Math.cos(angle) * distance
      const dy = Math.sin(angle) * distance - 40 - Math.random() * 80
      const delay = 80 + (i % 8) * 30

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: dx,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: dy + SCREEN_H * 0.12,
            duration: 1400,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, {
            toValue: 1,
            duration: 1400,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(700),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ])
    })

    Animated.parallel([
      // Expanding rings
      Animated.timing(ring1, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(ring2, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Check pop-in
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            friction: 5,
            tension: 120,
            useNativeDriver: true,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Soft glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.7,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        { iterations: 4 },
      ),
      // Content fade up
      Animated.sequence([
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(contentY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      ...burst,
    ]).start()
  }, [
    particles,
    ring1,
    ring2,
    checkScale,
    checkOpacity,
    contentOpacity,
    contentY,
    glow,
  ])

  const ringStyle = (anim: Animated.Value, maxScale: number) => ({
    opacity: anim.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0.55, 0.28, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.55, maxScale],
        }),
      },
    ],
  })

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.stage}>
        {particles.map((p, i) => {
          const spin = p.rotate.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${i % 2 === 0 ? 360 : -360}deg`],
          })
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.particle,
                p.shape === 'circle' ? styles.particleCircle : styles.particleRect,
                {
                  width: p.size,
                  height: p.shape === 'circle' ? p.size : p.size * 0.45,
                  backgroundColor: p.color,
                  opacity: p.opacity,
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { rotate: spin },
                    { scale: p.scale },
                  ],
                },
              ]}
            />
          )
        })}

        <Animated.View style={[styles.ring, ringStyle(ring1, 2.6)]} />
        <Animated.View
          style={[styles.ring, styles.ringThin, ringStyle(ring2, 3.2)]}
        />

        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glow,
              transform: [{ scale: checkScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.iconWrap,
            {
              opacity: checkOpacity,
              transform: [{ scale: checkScale }],
            },
          ]}
        >
          <Ionicons name="checkmark" size={48} color="#fff" />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentY }],
          },
        ]}
      >
        <Text style={styles.kicker}>Order confirmed</Text>
        <Text style={styles.title}>Thank you for your order!</Text>
        <Text style={styles.sub}>
          Your order{' '}
          <Text style={styles.strong}>{orderNumber || 'placed'}</Text> has been
          received.
        </Text>

        <View style={styles.noteCard}>
          <Ionicons name="sparkles" size={16} color={BRAND.primaryDark} />
          <Text style={styles.note}>
            If you paid by UPI, the store will verify your payment and confirm
            the order shortly.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primary}
          activeOpacity={0.9}
          onPress={() => router.replace('/customer-screens/home')}
        >
          <Text style={styles.primaryText}>Continue shopping</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

        {!!orderId && (
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => {
              // Clear checkout/UPI from the stack so their UI cannot ghost under order detail
              if (typeof (router as any).dismissAll === 'function') {
                ;(router as any).dismissAll()
              }
              router.replace({
                pathname: '/customer-screens/order-detail',
                params: { id: orderId },
              })
            }}
          >
            <Text style={styles.secondaryText}>View order status</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.bg,
    overflow: 'hidden',
  },
  bgOrbTop: {
    position: 'absolute',
    top: -SCREEN_W * 0.35,
    alignSelf: 'center',
    width: SCREEN_W * 1.2,
    height: SCREEN_W * 1.2,
    borderRadius: SCREEN_W,
    backgroundColor: withAlpha(BRAND.primary, 0.12),
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -SCREEN_W * 0.5,
    right: -SCREEN_W * 0.25,
    width: SCREEN_W * 0.9,
    height: SCREEN_W * 0.9,
    borderRadius: SCREEN_W,
    backgroundColor: withAlpha(BRAND.primaryDark, 0.08),
  },
  stage: {
    height: SCREEN_H * 0.38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  particle: {
    position: 'absolute',
  },
  particleCircle: {
    borderRadius: 99,
  },
  particleRect: {
    borderRadius: 3,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: withAlpha(BRAND.primary, 0.45),
  },
  ringThin: {
    borderWidth: 2,
    borderColor: withAlpha(BRAND.primaryDark, 0.35),
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: withAlpha(BRAND.primary, 0.28),
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.primaryDark,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: BRAND.primaryDark,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: BRAND.text,
    textAlign: 'center',
  },
  sub: {
    marginTop: 10,
    fontSize: 15,
    color: BRAND.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  strong: { fontWeight: '800', color: BRAND.text },
  noteCard: {
    marginTop: 18,
    marginBottom: 28,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: BRAND.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    maxWidth: 340,
  },
  note: {
    flex: 1,
    fontSize: 13,
    color: BRAND.textMuted,
    lineHeight: 19,
  },
  primary: {
    backgroundColor: BRAND.primary,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 16,
    minWidth: 240,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondary: {
    marginTop: 14,
    paddingVertical: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  secondaryText: { color: BRAND.primaryDark, fontWeight: '700', fontSize: 14 },
})
