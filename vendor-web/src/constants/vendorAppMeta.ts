/** Vendor web app version & changelog — shown under Settings → About */

export const APP_VERSION = '1.5.0'
export const APP_BUILD = '20240411'
export const LAST_UPDATED = 'April 11, 2024'

export const CHANGELOG: { version: string; date: string; notes: string }[] = [
  { version: '1.5.0', date: 'Apr 11, 2024', notes: 'Master on/off switch, unified schedule (multi-slot quiet & active modes), custom ringtone fix, per-event custom tone support.' },
  { version: '1.4.0', date: 'Apr 11, 2024', notes: 'Interval slots, per-event tones, repeat alerts, digest mode, 12 ringtones, local upload.' },
  { version: '1.3.0', date: 'Apr 11, 2024', notes: 'Quiet hours, browser push, volume control, version info.' },
  { version: '1.2.0', date: 'Apr 9, 2024', notes: 'Notification stats, mark-all-read, type filtering.' },
  { version: '1.1.0', date: 'Mar 26, 2024', notes: 'Purchase orders, supplier management, credit/debit memos.' },
]
