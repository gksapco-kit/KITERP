import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FileText, Star } from 'lucide-react'
import { resolveApiBaseUrl } from '@/lib/apiBase'
import { fmtMoney, humanize } from './shared'

/**
 * Customer portal (public, no login): reached through a private, revocable link issued from the dashboard.
 * Talks to `/public/realestate/portal/*` with the link token; shows only that customer's own data.
 */

type Booking = {
  id: string
  booking_no: string
  status: string
  project: string
  city: string | null
  unit: string
  agreement_value: number
  total_consideration: number
  paid_amount: number
  outstanding: number
  next_due: { demand_no: string; stage: string | null; due_date: string; amount: number; overdue: boolean } | null
  schedule: { seq: number; name: string; percent: number; due_date: string | null; total_due: number; paid: number; status: string }[]
  demands: { id: string; demand_no: string; stage: string | null; due_date: string | null; total: number; paid: number; status: string }[]
  receipts: { receipt_no: string; date: string; amount: number; tds: number; mode: string; status: string }[]
  handover: { handover_no: string; status: string; scheduled_on: string | null; offered_on: string | null; handed_over_on: string | null } | null
  snags: { id: string; category: string; location: string | null; description: string; severity: string; status: string; due_date: string | null }[]
  warranties: { id: string; coverage: string; starts_on: string; ends_on: string; statutory: boolean; active: boolean }[]
}
type Ticket = {
  id: string
  ticket_no: string
  subject: string
  category: string
  status: string
  due_at: string | null
  sla: string
  resolution: string | null
  comments: { author: string; by: string; body: string; at: string | null }[]
}
type Overview = {
  customer: { name: string; code: string | null; phone: string | null; email: string | null }
  bookings: Booking[]
  tickets: Ticket[]
  categories: string[]
}

const TOKEN_KEY = 're_portal_token'
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const errText = (e: any) => e?.response?.data?.detail || e?.message || 'Something went wrong'

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-semibold ${tone ?? 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number | ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => <th key={i} className="px-2 py-1.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-2 py-4 text-center text-slate-400">Nothing yet</td></tr>}
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export default function Portal() {
  const [params] = useSearchParams()
  // The private link carries the token once; keep it for this tab only and strip it from the address bar so it
  // does not linger in history, screenshots or Referer headers.
  const [token] = useState<string>(() => params.get('token') ?? sessionStorage.getItem(TOKEN_KEY) ?? '')
  const [letter, setLetter] = useState<{ html: string; name: string } | null>(null)
  useEffect(() => {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    if (window.location.search.includes('token=')) window.history.replaceState(null, '', window.location.pathname)
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [token])
  const qc = useQueryClient()
  const [sel, setSel] = useState<string>('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ subject: '', description: '', category: 'request' })
  const [reply, setReply] = useState<Record<string, string>>({})
  const [rating, setRating] = useState<Record<string, number>>({})

  const http = useMemo(
    () => axios.create({ baseURL: `${resolveApiBaseUrl()}/public/realestate/portal`, headers: { 'X-Portal-Token': token }, timeout: 30_000 }),
    [token],
  )

  const q = useQuery({
    queryKey: ['re-portal', token],
    queryFn: () => http.get<Overview>('/me').then((r) => r.data),
    enabled: !!token,
    retry: false,
  })
  const data = q.data
  const booking = data?.bookings.find((b) => b.id === sel) ?? data?.bookings[0]
  const refresh = () => qc.invalidateQueries({ queryKey: ['re-portal', token] })

  const newTicket = useMutation({
    mutationFn: () => http.post('/tickets', { ...form, booking_id: booking?.id ?? null }).then((r) => r.data),
    onSuccess: (out) => {
      setForm({ subject: '', description: '', category: 'request' })
      setNotice(out.message)
      refresh()
    },
    onError: (e) => setNotice(errText(e)),
  })
  const sendReply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => http.post(`/tickets/${id}/comments`, { body }).then((r) => r.data),
    onSuccess: (_o, v) => {
      setReply((s) => ({ ...s, [v.id]: '' }))
      refresh()
    },
    onError: (e) => setNotice(errText(e)),
  })
  const sendFeedback = useMutation({
    mutationFn: ({ id, stars }: { id: string; stars: number }) => http.post('/feedback', { rating: stars, ticket_id: id }).then((r) => r.data),
    onSuccess: (out) => setNotice(out.message),
    onError: (e) => setNotice(errText(e)),
  })
  if (!token) return <Shell><p className="text-center text-slate-600">This page needs the private link you were sent. Please open that link again.</p></Shell>
  if (q.isLoading) return <Shell><p className="text-center text-slate-500">Loading your account…</p></Shell>
  if (q.isError || !data) return <Shell><p className="text-center text-red-600">{errText(q.error)}</p></Shell>

  const openLetter = (id: string, name: string) =>
    http.get<string>(`/demands/${id}/letter`, { responseType: 'text', transformResponse: (r) => r })
      .then((r) => setLetter({ html: r.data, name }))
      .catch((e) => setNotice(errText(e)))

  return (
    <Shell>
      <div className="mb-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Welcome</p>
        <h1 className="text-xl font-semibold text-slate-900">{data.customer.name}</h1>
      </div>
      {notice && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900" onClick={() => setNotice('')}>{notice}</div>
      )}
      {letter && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" role="dialog" aria-label="Demand letter">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <span className="text-sm font-semibold text-slate-800">Demand letter {letter.name}</span>
              <div className="flex items-center gap-3 text-sm">
                <a
                  className="text-sky-700 hover:underline"
                  download={`${letter.name || 'demand-letter'}.html`}
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(letter.html)}`}
                >
                  Download
                </a>
                <button type="button" className="text-slate-600 hover:underline" onClick={() => setLetter(null)}>Close</button>
              </div>
            </div>
            {/* sandbox="" = no scripts, no same-origin access: the vendor-authored HTML cannot touch this page */}
            <iframe title="Demand letter" sandbox="" referrerPolicy="no-referrer" srcDoc={letter.html} className="h-full w-full flex-1 border-0" />
          </div>
        </div>
      )}

      {data.bookings.length === 0 ? (
        <Card title="Your bookings"><p className="text-sm text-slate-500">You have no active bookings yet.</p></Card>
      ) : (
        <>
          {data.bookings.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {data.bookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSel(b.id)}
                  className={`rounded-full border px-3 py-1 text-sm ${b.id === booking?.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  {b.unit} · {b.project}
                </button>
              ))}
            </div>
          )}
          {booking && (
            <div className="space-y-4">
              <Card title={`${booking.project} — ${booking.unit}`} right={<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{humanize(booking.status)}</span>}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Agreement value" value={fmtMoney(booking.agreement_value)} />
                  <Stat label="Paid so far" value={fmtMoney(booking.paid_amount)} tone="text-emerald-700" />
                  <Stat label="Outstanding" value={fmtMoney(booking.outstanding)} tone={booking.outstanding ? 'text-amber-700' : 'text-emerald-700'} />
                  <Stat
                    label="Next payment due"
                    value={booking.next_due ? `${fmtMoney(booking.next_due.amount)} · ${fmtDate(booking.next_due.due_date)}` : 'Nothing due'}
                    tone={booking.next_due?.overdue ? 'text-red-600' : undefined}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Booking {booking.booking_no}</p>
              </Card>

              <Card title="Payment schedule">
                <Table
                  head={['#', 'Instalment', 'Due', 'Amount', 'Paid', 'Status']}
                  rows={booking.schedule.map((s) => [s.seq, `${s.name} (${s.percent}%)`, fmtDate(s.due_date), fmtMoney(s.total_due), fmtMoney(s.paid), humanize(s.status)])}
                />
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Demand letters">
                  <Table
                    head={['Demand', 'Due', 'Amount', '']}
                    rows={booking.demands.map((d) => [
                      `${d.demand_no}${d.stage ? ` · ${d.stage}` : ''}`, fmtDate(d.due_date), fmtMoney(d.total),
                      <button key={d.id} type="button" onClick={() => openLetter(d.id, d.demand_no)} className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                        <FileText className="h-3.5 w-3.5" />View
                      </button>,
                    ])}
                  />
                </Card>
                <Card title="Payments received">
                  <Table
                    head={['Receipt', 'Date', 'Amount', 'Mode']}
                    rows={booking.receipts.map((r) => [r.receipt_no, fmtDate(r.date), fmtMoney(r.amount + r.tds), humanize(r.mode)])}
                  />
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Handover & possession">
                  {booking.handover ? (
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd>{humanize(booking.handover.status)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Scheduled</dt><dd>{fmtDate(booking.handover.scheduled_on)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Possession offered</dt><dd>{fmtDate(booking.handover.offered_on)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Handed over</dt><dd>{fmtDate(booking.handover.handed_over_on)}</dd></div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-500">Your handover has not been scheduled yet.</p>
                  )}
                  {booking.snags.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Snag list</p>
                      <Table
                        head={['Item', 'Severity', 'Status']}
                        rows={booking.snags.map((s) => [`${s.location ? `${s.location}: ` : ''}${s.description}`, humanize(s.severity), humanize(s.status)])}
                      />
                    </div>
                  )}
                </Card>
                <Card title="Warranty">
                  <Table
                    head={['Cover', 'Valid till', '']}
                    rows={booking.warranties.map((w) => [
                      `${humanize(w.coverage)}${w.statutory ? ' (statutory)' : ''}`, fmtDate(w.ends_on),
                      w.active ? <span key={w.id} className="text-emerald-700">Active</span> : <span key={w.id} className="text-slate-400">Ended</span>,
                    ])}
                  />
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 space-y-4">
        <Card title="Raise a request or complaint">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {data.categories.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
            <input className="h-10 rounded-lg border border-slate-300 px-3 text-sm md:col-span-2" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <textarea className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" placeholder="Describe the issue" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={form.subject.trim().length < 3 || newTicket.isPending}
            onClick={() => newTicket.mutate()}
          >
            Submit request
          </button>
          {booking && <p className="mt-2 text-xs text-slate-500">Linked to {booking.unit} · {booking.project}</p>}
        </Card>

        <Card title="Your requests">
          {data.tickets.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
          <div className="space-y-3">
            {data.tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{t.ticket_no} · {t.subject}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{humanize(t.status)}</span>
                </div>
                <p className="text-xs text-slate-500">{humanize(t.category)}{t.due_at && !['resolved', 'closed'].includes(t.status) ? ` · we aim to resolve by ${fmtDate(t.due_at)}` : ''}</p>
                {t.comments.map((c, i) => (
                  <p key={i} className={`mt-2 rounded-lg px-3 py-1.5 text-sm ${c.by === 'customer' ? 'bg-sky-50 text-sky-900' : 'bg-slate-50 text-slate-800'}`}>
                    <span className="mr-1 font-medium">{c.by === 'customer' ? 'You' : c.author || 'Support'}:</span>{c.body}
                  </p>
                ))}
                {t.resolution && <p className="mt-2 text-sm text-emerald-800">Resolution: {t.resolution}</p>}
                {t.status !== 'closed' && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                      placeholder={t.status === 'resolved' ? 'Not resolved? Reply to reopen' : 'Add a message'}
                      value={reply[t.id] ?? ''}
                      onChange={(e) => setReply((s) => ({ ...s, [t.id]: e.target.value }))}
                    />
                    <button
                      className="rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50"
                      disabled={!(reply[t.id] ?? '').trim() || sendReply.isPending}
                      onClick={() => sendReply.mutate({ id: t.id, body: reply[t.id] })}
                    >
                      Send
                    </button>
                  </div>
                )}
                {(t.status === 'resolved' || t.status === 'closed') && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                    Rate this service:
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => { setRating((s) => ({ ...s, [t.id]: n })); sendFeedback.mutate({ id: t.id, stars: n }) }} aria-label={`${n} stars`}>
                        <Star className={`h-5 w-5 ${(rating[t.id] ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Building2 className="h-5 w-5 text-slate-700" />
          <span className="text-sm font-semibold text-slate-800">Customer portal</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
