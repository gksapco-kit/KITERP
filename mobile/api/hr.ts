/**
 * HR API for the Expo mobile app.
 * Handles employee ESS: clock-in/out + GPS location pings.
 */
import apiClient from './client'

export interface ClockRecord {
  clocked_in: boolean
  clocked_out: boolean
  employee_id: string
  record?: {
    clock_in?: string
    clock_out?: string
    work_hours?: number
    clock_in_location?: { lat: number; lng: number }
    clock_out_location?: { lat: number; lng: number }
  }
}

export interface LocationPingPayload {
  lat: number
  lng: number
  accuracy?: number
  speed?: number | null
  heading?: number | null
  battery?: number
  source?: string
  recorded_at?: string
}

export const hrApi = {
  getTodayAttendance: async (): Promise<ClockRecord> => {
    const res = await apiClient.get('/store/hr/ess/attendance/today')
    return res.data
  },

  clockIn: async (location?: { lat: number; lng: number; accuracy?: number }): Promise<ClockRecord> => {
    const res = await apiClient.post('/store/hr/ess/attendance/clock-in', {
      location: location ?? null,
    })
    return res.data
  },

  clockOut: async (location?: { lat: number; lng: number; accuracy?: number }): Promise<ClockRecord> => {
    const res = await apiClient.post('/store/hr/ess/attendance/clock-out', {
      location: location ?? null,
    })
    return res.data
  },

  sendLocationPing: async (payload: LocationPingPayload): Promise<void> => {
    await apiClient.post('/store/hr/ess/tracking/ping', {
      ...payload,
      source: payload.source ?? 'app',
    })
  },
}
