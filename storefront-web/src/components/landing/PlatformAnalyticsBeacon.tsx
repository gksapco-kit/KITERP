import { usePlatformJourneyBeacon } from '@/hooks/usePlatformJourneyBeacon'

/** Fires platform page_view beacons for Super Admin → Website Analytics → KITERP.com */
export function PlatformAnalyticsBeacon() {
  usePlatformJourneyBeacon()
  return null
}
