import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, MessageCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE as string | undefined
const SUPPORT_CHAT_URL = import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined

export function HelpAccordion() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 transition-colors',
          open ? 'bg-accent' : 'hover:bg-gray-50',
        )}
      >
        <HelpCircle className="w-4 h-4 text-primary/80 shrink-0" />
        <span className="flex-1 text-left">Help &amp; Support</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-1.5">
          <Link
            to="/forgot-password"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all"
          >
            <span className="text-base">🔑</span>
            <div>
              <p className="font-medium leading-tight">Reset my password</p>
              <p className="text-[11px] text-gray-500">Send a reset code to your email or phone</p>
            </div>
          </Link>

          {SUPPORT_PHONE ? (
            <a
              href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all"
            >
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="font-medium leading-tight">Call support</p>
                <p className="text-[11px] text-gray-500 font-mono">{SUPPORT_PHONE}</p>
              </div>
            </a>
          ) : (
            <a
              href="mailto:support@kiterp.com"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all"
            >
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="font-medium leading-tight">Contact support</p>
                <p className="text-[11px] text-gray-500">support@kiterp.com</p>
              </div>
            </a>
          )}

          <a
            href={SUPPORT_CHAT_URL || 'mailto:support@kiterp.com'}
            target={SUPPORT_CHAT_URL ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-medium leading-tight">Chat with us</p>
              <p className="text-[11px] text-gray-500">
                {SUPPORT_CHAT_URL ? 'WhatsApp / live chat' : 'support@kiterp.com'}
              </p>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
