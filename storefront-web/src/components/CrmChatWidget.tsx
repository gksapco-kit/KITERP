import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '')
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

export default function CrmChatWidget({ vendorId, vendorName, themeColor = '#2563eb' }: Props) {
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
      const res = await fetch(`${API_URL}/public/crm/chat/widget/${vendorId}/conversations/${visitorIdRef.current}`)
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
      const res = await fetch(`${API_URL}/public/crm/chat/widget/${vendorId}/messages`, {
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
        <div className="fixed bottom-5 right-5 z-50 w-80 sm:w-96 h-[520px] max-h-[calc(100vh-40px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 text-white flex items-center justify-between" style={{ backgroundColor: themeColor }}>
            <div>
              <p className="text-sm font-semibold">{vendorName || 'Chat with us'}</p>
              <p className="text-xs text-white/80">We typically reply in a few minutes.</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {!introDone ? (
            <form onSubmit={submitIntro} className="flex-1 p-4 flex flex-col gap-3 bg-gray-50">
              <p className="text-sm text-gray-700">Hi! Tell us a bit about yourself so we can help.</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="h-10 rounded-md border border-gray-200 px-3 text-sm" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)"
                className="h-10 rounded-md border border-gray-200 px-3 text-sm" />
              <button type="submit" className="h-10 rounded-md text-white text-sm font-medium" style={{ backgroundColor: themeColor }}>
                Start chat
              </button>
              <p className="text-xs text-gray-400 text-center">By chatting you accept our privacy policy.</p>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-6">
                    Send us a message and we'll get back to you shortly.
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender === 'customer'
                  const bot = m.sender === 'bot'
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        mine ? 'text-white' :
                        bot ? 'bg-primary/10 text-primary' :
                        'bg-white border border-gray-200 text-gray-800'
                      }`}
                      style={mine ? { backgroundColor: themeColor } : undefined}>
                        {bot && <p className="text-xs uppercase font-semibold mb-1 opacity-70">Bot</p>}
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              <div className="border-t p-2 flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Type a message…"
                  className="flex-1 h-10 rounded-md border border-gray-200 px-3 text-sm" />
                <button onClick={send} disabled={!draft.trim() || sending}
                  className="h-10 w-10 rounded-md text-white flex items-center justify-center disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}>
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
