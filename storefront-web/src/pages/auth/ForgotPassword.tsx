import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVendor } from '@/contexts/VendorContext'
import { imgUrl } from '@/lib/utils'
import { Store, ShieldCheck, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuthStoreTheme } from './authStoreTheme'

export default function ForgotPassword() {
  const { vendor, storePath } = useVendor()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { primary, background, linkColor, btnText, panelGradient, fontFamily } = useAuthStoreTheme()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-3 py-8 sm:px-4 sm:py-10" style={{ backgroundColor: background, fontFamily }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-6 sm:px-8 sm:py-8 text-center" style={{ background: panelGradient }}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-white/25">
              {vendor?.logo_url ? (
                <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <Store className="w-8 h-8 text-white" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{vendor?.display_name || 'Our Store'}</h1>
          </div>

          <div className="px-4 py-6 sm:px-8 sm:py-8">
            {submitted ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold text-gray-900">Check your inbox</h2>
                <p className="text-sm text-gray-600">
                  If <strong>{email}</strong> is linked to an account, we've sent a password reset link.
                  Check your spam folder if you don't see it within a few minutes.
                </p>
                <Link to={storePath('/login')}>
                  <Button className="w-full mt-2" style={{ backgroundColor: primary, color: btnText }}>
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Forgot password?</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Enter your email and we'll send a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-11 pl-10 border-gray-300"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-bold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: primary, color: btnText }}
                  >
                    Send Reset Link
                  </Button>
                </form>

                <Link
                  to={storePath('/login')}
                  className="flex items-center justify-center gap-1.5 mt-6 text-sm font-medium transition-colors"
                  style={{ color: linkColor }}
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 py-4 border-t text-xs text-gray-500" style={{ backgroundColor: background }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secured by KITERP</span>
          </div>
        </div>
      </div>
    </div>
  )
}
