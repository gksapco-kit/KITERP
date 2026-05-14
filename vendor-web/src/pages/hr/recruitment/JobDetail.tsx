import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Calendar, X, Star, Users as UsersIcon } from 'lucide-react'
import {
  useHRJob, useHRApplications, useCreateHRApplication, useMoveHRStage,
  useHRCandidates, useCreateHRInterview,
} from '@/hooks/useVendor'
import type { JobApplication, Candidate } from '@/types'

const STAGES: { key: JobApplication['current_stage']; label: string; color: string }[] = [
  { key: 'applied',      label: 'Applied',      color: 'border-gray-300 bg-gray-50' },
  { key: 'screening',    label: 'Screening',    color: 'border-blue-300 bg-blue-50' },
  { key: 'shortlisted',  label: 'Shortlisted',  color: 'border-indigo-300 bg-indigo-50' },
  { key: 'interviewing', label: 'Interviewing', color: 'border-amber-300 bg-amber-50' },
  { key: 'offer_made',   label: 'Offer Made',   color: 'border-primary/40 bg-accent' },
  { key: 'hired',        label: 'Hired',        color: 'border-green-300 bg-green-50' },
  { key: 'rejected',     label: 'Rejected',     color: 'border-red-300 bg-red-50' },
]

function AddCandidateToJobModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: candidates = [] } = useHRCandidates()
  const create = useCreateHRApplication()
  const [search, setSearch] = useState('')
  const filtered = useMemo(
    () => (candidates as Candidate[]).filter(c =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [candidates, search]
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Add Candidate to Pipeline</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 border-b">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates…"
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No candidates found.</div>
          ) : filtered.map(c => (
            <button key={c.id}
              onClick={async () => {
                await create.mutateAsync({ candidate_id: c.id, job_posting_id: jobId, current_stage: 'applied' })
                onClose()
              }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b">
              <p className="text-sm font-medium">{c.full_name}</p>
              <p className="text-[11px] text-gray-500">{c.email ?? c.phone ?? c.current_designation ?? ''}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScheduleInterviewModal({ application, onClose }: { application: JobApplication; onClose: () => void }) {
  const create = useCreateHRInterview()
  const nextRound = (application.interviews?.length ?? 0) + 1
  const [form, setForm] = useState({
    round_name: `Round ${nextRound}`,
    scheduled_at: '',
    duration_min: 60,
    mode: 'video',
    location_or_link: '',
  })
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      application_id: application.id,
      round_number: nextRound,
      round_name: form.round_name,
      scheduled_at: form.scheduled_at || null,
      duration_min: Number(form.duration_min) || 60,
      mode: form.mode,
      location_or_link: form.location_or_link || null,
    })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Schedule Interview</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Round Name</label>
            <input value={form.round_name} onChange={e => setForm({ ...form, round_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">When</label>
            <input type="datetime-local" required value={form.scheduled_at}
              onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Duration (min)</label>
              <input type="number" value={form.duration_min}
                onChange={e => setForm({ ...form, duration_min: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase">Mode</label>
              <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 uppercase">Link / Location</label>
            <input value={form.location_or_link}
              onChange={e => setForm({ ...form, location_or_link: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="https://meet…" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {create.isPending ? 'Saving…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: job, isLoading } = useHRJob(id)
  const { data: applications = [] } = useHRApplications({ job_id: id })
  const moveStage = useMoveHRStage()
  const [showAdd, setShowAdd] = useState(false)
  const [scheduleFor, setScheduleFor] = useState<JobApplication | null>(null)

  const grouped = useMemo(() => {
    const g: Record<string, JobApplication[]> = {}
    STAGES.forEach(s => { g[s.key] = [] })
    ;(applications as JobApplication[]).forEach(a => {
      ;(g[a.current_stage] ??= []).push(a)
    })
    return g
  }, [applications])

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>
  if (!job) return <div className="p-6 text-gray-400">Job not found.</div>

  return (
    <div className="p-6">
      <Link to="/hr/recruitment" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to recruitment
      </Link>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {job.department?.name ?? '—'}
            {job.designation && ` · ${job.designation.name}`}
            {job.location && ` · ${job.location}`}
            {' · '}{job.openings} opening{job.openings === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add to pipeline
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {STAGES.map(stage => (
          <div key={stage.key} className={`border-2 ${stage.color} rounded-lg p-2 min-h-[300px]`}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-bold uppercase text-gray-700">{stage.label}</h3>
              <span className="text-xs text-gray-500">{grouped[stage.key]?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(grouped[stage.key] ?? []).map(app => (
                <div key={app.id} className="bg-white border rounded-lg p-2 shadow-sm">
                  <p className="text-sm font-medium text-gray-900">{app.candidate?.full_name ?? '—'}</p>
                  <p className="text-[11px] text-gray-500 mb-1">{app.candidate?.current_designation ?? ''}</p>
                  {app.rating ? (
                    <p className="text-[11px] text-amber-600 flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {app.rating}/5
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <select defaultValue={app.current_stage}
                      onChange={e => moveStage.mutate({ id: app.id, stage: e.target.value })}
                      className="text-[11px] border rounded px-1 py-0.5">
                      {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button onClick={() => setScheduleFor(app)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Schedule interview">
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {app.interviews && app.interviews.length > 0 && (
                    <div className="mt-1 text-[10px] text-gray-500 flex items-center gap-1">
                      <UsersIcon className="w-3 h-3" /> {app.interviews.length} round{app.interviews.length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddCandidateToJobModal jobId={id} onClose={() => setShowAdd(false)} />}
      {scheduleFor && <ScheduleInterviewModal application={scheduleFor} onClose={() => setScheduleFor(null)} />}
    </div>
  )
}
