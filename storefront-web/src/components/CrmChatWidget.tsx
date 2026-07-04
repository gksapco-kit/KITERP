import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
const VISITOR_KEY = 'asure_visitor_id'

function ensureVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

type Message = {
  id: string
  sender: string
  body?: string | null
  created_at: string
}

type Props = {
  vendorId: string
  vendorName?: string
  themeColor?: string
}

/** Match OS appearance and storefront dark template. */
function useChatDarkMode(): boolean {
  const theme = useTheme()
  const [prefersDark, setPrefersDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return theme.template === 'dark' || prefersDark
}

export default function CrmChatWidget({ vendorId, vendorName, themeColor = '#2563eb' }: Props) {
  const isDark = useChatDarkMode()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [introDone, setIntroDone] = useState(false)
  const [sending, setSending] = useState(false)
  const visitorIdRef = useRef<string>('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    visitorIdRef.current = ensureVisitorId()
    const cached = localStorage.getItem('asure_visitor_meta')
    if (cached) {
      try {
        const meta = JSON.parse(cached)
        if (meta.name) setName(meta.name)
        if (meta.email) setEmail(meta.email)
        if (meta.name || meta.email) setIntroDone(true)
      } catch { /* ignore */ }
    }
  }, [])

  const loadHistory = useCallback(async () => {
    if (!visitorIdRef.current) return
    try {
      const res = await fetch(`${getStorefrontApiBaseUrl()}/public/crm/chat/widget/${vendorId}/conversations/${visitorIdRef.current}`)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data?.messages) ? data.messages : []
      setMessages(list)
    } catch { /* ignore */ }
  }, [vendorId])

  useEffect(() => {
    if (open && introDone) void loadHistory()
  }, [open, introDone, loadHistory])

  /** While the panel is open, sync from the server so agent/bot replies appear without reopening. */
  useEffect(() => {
    if (!open || !introDone) return
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void loadHistory()
    }
    const id = window.setInterval(tick, 2500)
    return () => window.clearInterval(id)
  }, [open, introDone, loadHistory])

  const lastMessageKey = messages.length ? `${messages[messages.length - 1]?.id ?? ''}-${messages.length}` : '0'
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lastMessageKey, open])

  const send = async () => {
    if (!draft.trim() || sending) return
    const body = draft.trim()
    setDraft('')
    const tempId = `temp_${Date.now()}`
    setMessages((prev) => [...prev, { id: tempId, sender: 'customer', body, created_at: new Date().toISOString() }])
    setSending(true)
    try {
      const res = await fetch(`${getStorefrontApiBaseUrl()}/public/crm/chat/widget/${vendorId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_id: visitorIdRef.current,
          visitor_name: name || undefined,
          visitor_email: email || undefined,
          body,
        }),
      })
      if (!res.ok) throw new Error('send failed')
      await loadHistory()
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft(body)
    } finally {
      setSending(false)
    }
  }

  const submitIntro = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() && !email.trim()) return
    localStorage.setItem('asure_visitor_meta', JSON.stringify({ name, email }))
    setIntroDone(true)
  }

  const fieldClass = cn(
    'h-10 rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30',
    isDark
      ? 'border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500'
      : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400',
  )

  if (!vendorId) return null

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-2xl text-white flex items-center justify-center hover:scale-105 transition-transform"
          style={{ backgroundColor: themeColor }}
          aria-label="Open chat"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {open && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-50 w-80 sm:w-96 h-[520px] max-h-[calc(100vh-40px)] rounded-2xl shadow-2xl border flex flex-col overflow-hidden',
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-gray-900',
          )}
          style={{ colorScheme: isDark ? 'dark' : 'light' }}
        >
          <div className="px-4 py-3 text-white flex items-center justify-between" style={{ backgroundColor: themeColor }}>
            <div>
              <p className="text-sm font-semibold">{vendorName || 'Chat with us'}</p>
              <p className="text-xs text-white/80">We typically reply in a few minutes.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-white/10 rounded"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!introDone ? (
            <form
              onSubmit={submitIntro}
              className={cn('flex-1 p-4 flex flex-col gap-3', isDark ? 'bg-slate-950' : 'bg-gray-50')}
            >
              <p className={cn('text-sm', isDark ? 'text-slate-300' : 'text-gray-700')}>
                Hi! Tell us a bit about yourself so we can help.
              </p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={fieldClass} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className={fieldClass}
              />
              <button type="submit" className="h-10 rounded-md text-white text-sm font-medium" style={{ backgroundColor: themeColor }}>
                Start chat
              </button>
              <p className={cn('text-xs text-center', isDark ? 'text-slate-500' : 'text-gray-400')}>
                By chatting you accept our privacy policy.
              </p>
            </form>
          ) : (
            <>
              <div className={cn('flex-1 overflow-y-auto p-3 space-y-2', isDark ? 'bg-slate-950' : 'bg-gray-50')}>
                {messages.length === 0 && (
                  <div className={cn('text-center text-xs py-6', isDark ? 'text-slate-500' : 'text-gray-400')}>
                    Send us a message and we'll get back to you shortly.
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender === 'customer'
                  const bot = m.sender === 'bot'
                  const bubbleClass = mine
                    ? 'text-white'
                    : bot
                      ? isDark
                        ? 'bg-primary/20 border border-primary/35 text-slate-100'
                        : 'bg-primary/10 border border-primary/20 text-gray-900'
                      : isDark
                        ? 'bg-slate-800 border border-slate-600 text-slate-100'
                        : 'bg-white border border-gray-200 text-gray-900'

                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', bubbleClass)}
                        style={mine ? { backgroundColor: themeColor } : undefined}
                      >
                        {bot && (
                          <p
                            className={cn(
                              'text-xs uppercase font-semibold mb-1',
                              isDark ? 'text-slate-300' : 'text-gray-600',
                            )}
                          >
                            Bot
                          </p>
                        )}
                        <p
                          className={cn(
                            'whitespace-pre-wrap',
                            mine
                              ? 'text-white selection:bg-white/30 selection:text-white'
                              : isDark
                                ? 'text-slate-100 selection:bg-primary/40 selection:text-white'
                                : 'text-gray-900 selection:bg-primary/25 selection:text-gray-900',
                          )}
                        >
                          {m.body}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              <div className={cn('border-t p-2 flex gap-2', isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white')}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Type a message…"
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="h-10 w-10 rounded-md text-white flex items-center justify-center disabled:opacity-50 shrink-0"
                  style={{ backgroundColor: themeColor }}
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
