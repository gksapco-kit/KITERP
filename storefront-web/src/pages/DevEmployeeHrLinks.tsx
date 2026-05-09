/**
 * Local helper page — lists Employee HR / ESS URLs for the current origin.
 * Open: http://localhost:3002/local/employee-hr
 *
 * Default slug matches `backend/setup_vendor.py` (VENDOR_SLUG = "test").
 * Override with VITE_DEV_VENDOR_SLUG in .env
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

const DEV_SLUG =
  (import.meta.env.VITE_DEV_VENDOR_SLUG as string | undefined)?.trim() || 'test'

export default function DevEmployeeHrLinks() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const base = `${origin}/store/${DEV_SLUG}`

  const rows = useMemo(
    () => [
      { label: 'Store home (loads vendor)', href: `${base}/` },
      { label: 'Employee HR login', href: `${base}/hr/login` },
      { label: 'Employee HR login · branch 1000', href: `${base}/hr/login?branch=1000` },
      { label: 'ESS dashboard (needs login)', href: `${base}/hr` },
      { label: 'ESS policies', href: `${base}/hr/policies` },
      { label: 'ESS attendance', href: `${base}/hr/attendance` },
    ],
    [base],
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Employee HR / ESS — test links</h1>
      <p className="text-sm text-slate-600 mb-2">
        Storefront dev server: <strong className="font-mono">port 3002</strong> (see <code className="bg-slate-200 px-1 rounded">vite.config.ts</code>).
      </p>
      <p className="text-sm text-slate-600 mb-6">
        Vendor slug in URLs: <strong className="font-mono">{DEV_SLUG}</strong>
        {' '}(set <code className="bg-slate-200 px-1 rounded">VITE_DEV_VENDOR_SLUG</code> in <code className="bg-slate-200 px-1 rounded">storefront-web/.env</code> if yours differs).
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-950 mb-4">
        <p className="font-semibold mb-1">If links show “No store with this slug”</p>
        <p>
          From the <code className="bg-amber-100 px-1 rounded">backend</code> folder run{' '}
          <code className="bg-amber-100 px-1 rounded">python setup_vendor.py</code> and use the slug it prints (often{' '}
          <code className="font-mono">test</code>), or create a vendor in the admin flow so{' '}
          <code className="font-mono">/catalog/vendor/{'{slug}'}</code> returns 200.
        </p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-950 mb-8">
        <p className="font-semibold mb-1">Test sign-in (pick one)</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Single dev worker</strong> —{' '}
            <code className="bg-emerald-100 px-1 rounded">python seed_dev_hr_employee.py</code>
            {' '}(defaults: email <code className="font-mono">hr.worker@dev.kiterp</code>, password{' '}
            <code className="font-mono">DevHR2024!</code>, vendor slug <code className="font-mono">test</code>).
          </li>
          <li>
            <strong>Full HR seed set</strong> —{' '}
            <code className="bg-emerald-100 px-1 rounded">python seed_hr.py --vendor-slug YOUR_SLUG</code>
            {' '}(must match the store URL, e.g. <code className="font-mono">test</code> or <code className="font-mono">gvkrishna-store</code>).
            Then <code className="font-mono">aakash@seed.test</code> / <code className="font-mono">Test@1234</code>.
            Re-run the seed after changing that user’s password elsewhere so it resets to <code className="font-mono">Test@1234</code>.
          </li>
          <li>
            <strong>Your own Gmail (or any email)</strong> — employee HR is not the vendor dashboard login.
            Create an ESS row with{' '}
            <code className="bg-emerald-100 px-1 rounded">python seed_dev_hr_employee.py --slug YOUR_SLUG --email you@gmail.com --password Test@1234</code>
            {' '}then open <code className="font-mono">/store/YOUR_SLUG/hr/login</code>.
          </li>
        </ul>
      </div>

      <ul className="space-y-3">
        {rows.map(({ label, href }) => (
          <li key={href} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <a
              href={href}
              className="text-blue-600 hover:underline font-medium break-all"
            >
              {label}
            </a>
            <span className="text-xs text-slate-500 font-mono break-all">{href}</span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-slate-600">
        <Link to="/" className="text-blue-600 hover:underline">← Public landing</Link>
      </p>
    </div>
  )
}
