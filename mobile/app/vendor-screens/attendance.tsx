/**
 * Employee Self-Service Attendance screen.
 * Clock In / Clock Out with GPS capture + background location tracking.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { hrApi, type ClockRecord } from '../../api/hr'
import {
  startLocationTracking,
  stopLocationTracking,
  isLocationTrackingActive,
  getOneShot,
} from '../../lib/locationTracking'

type StatusColour = { bg: string; text: string }

const STATUS_COLOURS: Record<string, StatusColour> = {
  present:  { bg: '#dcfce7', text: '#166534' },
  late:     { bg: '#fef9c3', text: '#92400e' },
  absent:   { bg: '#fee2e2', text: '#991b1b' },
  half_day: { bg: '#fef3c7', text: '#92400e' },
  on_leave: { bg: '#ede9fe', text: '#5b21b6' },
}

function fmt(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtCoords(loc?: { lat: number; lng: number }): string {
  if (!loc) return ''
  return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
}

export default function AttendanceScreen() {
  const [record, setRecord] = useState<ClockRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [trackingActive, setTrackingActive] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadToday = useCallback(async () => {
    try {
      const data = await hrApi.getTodayAttendance()
      setRecord(data)
    } catch (err) {
      console.warn('Attendance fetch error', err)
    }
  }, [])

  const checkTracking = useCallback(async () => {
    setTrackingActive(await isLocationTrackingActive())
  }, [])

  useEffect(() => {
    Promise.all([loadToday(), checkTracking()]).finally(() => setLoading(false))
  }, [loadToday, checkTracking])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadToday(), checkTracking()])
    setRefreshing(false)
  }, [loadToday, checkTracking])

  const handleClockIn = async () => {
    setBusy(true)
    try {
      const loc = await getOneShot()
      await hrApi.clockIn(loc ?? undefined)
      // Start background tracking after successful clock-in
      const started = await startLocationTracking()
      setTrackingActive(started)
      if (!started) {
        Alert.alert(
          'Location Permission',
          'Background location permission was not granted. Your location will not be tracked while on duty.',
        )
      }
      await loadToday()
    } catch (err: any) {
      Alert.alert('Clock In Failed', err?.response?.data?.detail ?? 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleClockOut = async () => {
    setBusy(true)
    try {
      const loc = await getOneShot()
      await hrApi.clockOut(loc ?? undefined)
      await stopLocationTracking()
      setTrackingActive(false)
      await loadToday()
    } catch (err: any) {
      Alert.alert('Clock Out Failed', err?.response?.data?.detail ?? 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const clockedIn = !!record?.clocked_in
  const clockedOut = !!record?.clocked_out
  const rec = record?.record

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#111827' }}>
          My Attendance
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>

        {/* Today card */}
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Today
          </Text>

          {/* Clock times */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: '#eff6ff', borderRadius: 12, padding: 14 }}>
              <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '600', marginBottom: 4 }}>CLOCK IN</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1d4ed8' }}>{fmt(rec?.clock_in)}</Text>
              {rec?.clock_in_location && (
                <Text style={{ fontSize: 10, color: '#93c5fd', marginTop: 4 }}>
                  📍 {fmtCoords(rec.clock_in_location)}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff7ed', borderRadius: 12, padding: 14 }}>
              <Text style={{ fontSize: 11, color: '#f97316', fontWeight: '600', marginBottom: 4 }}>CLOCK OUT</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#c2410c' }}>{fmt(rec?.clock_out)}</Text>
              {rec?.clock_out_location && (
                <Text style={{ fontSize: 10, color: '#fdba74', marginTop: 4 }}>
                  📍 {fmtCoords(rec.clock_out_location)}
                </Text>
              )}
            </View>
          </View>

          {/* Tracking banner */}
          {clockedIn && !clockedOut && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: trackingActive ? '#dcfce7' : '#fef9c3',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 16 }}>{trackingActive ? '📡' : '⚠️'}</Text>
              <Text style={{ fontSize: 12, color: trackingActive ? '#166534' : '#92400e', flex: 1 }}>
                {trackingActive
                  ? 'Location is being shared with HR while on duty.'
                  : 'Background location not active. HR cannot see your live location.'}
              </Text>
            </View>
          )}

          {/* Action button */}
          {busy ? (
            <ActivityIndicator color="#2563eb" style={{ marginTop: 4 }} />
          ) : !clockedIn ? (
            <TouchableOpacity
              onPress={handleClockIn}
              style={{
                backgroundColor: '#16a34a',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>🟢  Clock In</Text>
            </TouchableOpacity>
          ) : !clockedOut ? (
            <TouchableOpacity
              onPress={handleClockOut}
              style={{
                backgroundColor: '#ea580c',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>🔴  Clock Out</Text>
            </TouchableOpacity>
          ) : (
            <View style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
            }}>
              <Text style={{ color: '#374151', fontSize: 15, fontWeight: '600' }}>✅  Day Complete</Text>
              {rec?.work_hours != null && (
                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                  {Number(rec.work_hours).toFixed(1)} hours worked
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Location tracking info */}
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 16,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 2,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
            📍 Location Tracking
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280', lineHeight: 18 }}>
            Your location is shared with your employer only while you are clocked in. It is used to confirm you are on-site and to optimise field operations.{'\n\n'}
            Tracking automatically stops when you clock out or close the app at end of shift.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
