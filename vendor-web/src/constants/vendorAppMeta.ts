/** Vendor web app version & changelog — shown under Settings → About */

export const APP_VERSION = '2.6.0'
export const APP_BUILD = '20260411'
export const LAST_UPDATED = 'April 11, 2026'

export const CHANGELOG: { version: string; date: string; notes: string }[] = [
  { version: '2.6.0', date: 'Apr 11, 2026', notes: 'Master on/off switch, unified schedule (multi-slot quiet & active modes), custom ringtone fix, per-event custom tone support.' },
  { version: '2.5.0', date: 'Apr 11, 2026', notes: 'Interval slots, per-event tones, repeat alerts, digest mode, 12 ringtones, local upload.' },
  { version: '2.4.1', date: 'Apr 11, 2026', notes: 'Quiet hours, browser push, volume control, version info.' },
  { version: '2.4.0', date: 'Apr 9, 2026', notes: 'Notification stats, mark-all-read, type filtering.' },
  { version: '2.3.0', date: 'Mar 26, 2026', notes: 'Purchase orders, supplier management, credit/debit memos.' },
]
