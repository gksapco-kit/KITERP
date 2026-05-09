/**
 * Cross-app URLs. Set in `.env` for staging/production, e.g.
 *   VITE_VENDOR_URL=https://vendor.example.com
 *   VITE_ADMIN_URL=https://admin.example.com
 */
export const vendorAppUrl = import.meta.env.VITE_VENDOR_URL || 'http://localhost:3001'
export const adminAppUrl = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3000'
