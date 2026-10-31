/** Vendor web app version & changelog — shown under Settings → About */

export const APP_VERSION = '1.5.0'
export const APP_BUILD = '20251015'
export const LAST_UPDATED = 'October 15, 2025'

/** Newest first. Releases follow the module menu order: core modules first, later modules last. */
export const CHANGELOG: { version: string; date: string; notes: string }[] = [
  { version: '1.5.0', date: 'Oct 15, 2025', notes: 'Controlling Management, HR Management and System Configuration (notification master on/off switch, unified quiet & active schedule, custom ringtones, per-event tones).' },
  { version: '1.4.0', date: 'Sep 18, 2025', notes: 'Procurement Management (purchase orders, supplier management, credit/debit memos) and Finance Management.' },
  { version: '1.3.0', date: 'Aug 21, 2025', notes: 'Restaurant and Commission Management.' },
  { version: '1.2.0', date: 'Jul 24, 2025', notes: 'Production Management and Pharmaceutical Manufacturing.' },
  { version: '1.1.0', date: 'Jun 26, 2025', notes: 'My Kit workspace, CRM Management and Rental Management.' },
  { version: '1.0.0', date: 'May 15, 2025', notes: 'Initial release: Website Management, Sales Management, Inventory Management and Master Data Management.' },
]
