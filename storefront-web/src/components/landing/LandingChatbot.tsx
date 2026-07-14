import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { apiClient } from '@/api/client'
import {
  CHAT_QUICK_PROMPTS,
  OPEN_LANDING_CHAT_EVENT,
  replyToLandingQuestion,
  type ChatContact,
  type ChatMessage,
} from '@/components/landing/landingChatKnowledge'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  text: 'Hi! Ask me about KIT ERP pricing, apps, signup, or contact details.',
}

export function LandingChatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [contact, setContact] = useState<ChatContact | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<ChatContact>('/catalog/platform-contact')
      .then((res) => {
        if (!cancelled) setContact(res.data)
      })
      .catch(() => {
        if (!cancelled) setContact(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_LANDING_CHAT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_LANDING_CHAT_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, open, busy])

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setBusy(true)
    window.setTimeout(() => {
      const answer = replyToLandingQuestion(trimmed, contact)
      setMessages((prev) => [...prev, { id: uid(), role: 'bot', text: answer }])
      setBusy(false)
    }, 280)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="kiterp-chatbot">
      {open ? (
        <div className="kiterp-chatbot-panel" role="dialog" aria-label="KIT ERP assistant">
          <header className="kiterp-chatbot-header">
            <div>
              <p className="kiterp-chatbot-title">KIT ERP Assistant</p>
              <p className="kiterp-chatbot-subtitle">Pricing · Apps · Contact · Signup</p>
            </div>
            <button
              type="button"
              className="kiterp-chatbot-icon-btn"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="kiterp-chatbot-messages" ref={listRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'bot' ? 'kiterp-chatbot-bubble kiterp-chatbot-bubble--bot' : 'kiterp-chatbot-bubble kiterp-chatbot-bubble--user'
                }
              >
                {m.text.split('\n').map((line, i) => (
                  <span key={`${m.id}-${i}`}>
                    {i > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </div>
            ))}
            {busy ? (
              <div className="kiterp-chatbot-bubble kiterp-chatbot-bubble--bot kiterp-chatbot-typing">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            ) : null}
          </div>

          <div className="kiterp-chatbot-quick">
            {CHAT_QUICK_PROMPTS.map((p) => (
              <button key={p} type="button" className="kiterp-chatbot-chip" onClick={() => ask(p)} disabled={busy}>
                {p}
              </button>
            ))}
          </div>

          <form className="kiterp-chatbot-composer" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a basic question…"
              disabled={busy}
              aria-label="Chat message"
            />
            <button type="submit" className="kiterp-chatbot-send" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="kiterp-chatbot-footer">
            Need a human?{' '}
            <Link to="/contact" onClick={() => setOpen(false)}>
              Contact page
            </Link>
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className="kiterp-chatbot-fab"
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!open ? <span className="kiterp-chatbot-fab-label">Ask KIT</span> : null}
      </button>
    </div>
  )
}

export function openLandingChat() {
  window.dispatchEvent(new Event(OPEN_LANDING_CHAT_EVENT))
}
