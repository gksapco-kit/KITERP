import { onModalBackdropClick, cn } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass } from '@/lib/modalUi'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useState, useMemo, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Calendar, X, Star, Briefcase, MapPin,
  Clock, ExternalLink, Mail, Phone, Users as UsersIcon,
} from 'lucide-react'
import {
  useHRJob, useHRApplications, useCreateHRApplication, useMoveHRStage,
  useHRCandidates, useCreateHRInterview,
} from '@/hooks/useVendor'
import type { JobApplication, Candidate, InterviewRound } from '@/types'

const STAGES: {
  key: JobApplication['current_stage']
  label: string
  accent: string
  header: string
  count: string
  empty: string
}[] = [
  { key: 'applied', label: 'Applied', accent: 'bg-slate-400', header: 'bg-slate-50 border-slate-200', count: 'bg-slate-200 text-slate-700', empty: 'border-slate-200' },
  { key: 'screening', label: 'Screening', accent: 'bg-sky-500', header: 'bg-sky-50 border-sky-200', count: 'bg-sky-100 text-sky-800', empty: 'border-sky-200' },
  { key: 'shortlisted', label: 'Shortlisted', accent: 'bg-violet-500', header: 'bg-violet-50 border-violet-200', count: 'bg-violet-100 text-violet-800', empty: 'border-violet-200' },
  { key: 'interviewing', label: 'Interviewing', accent: 'bg-amber-500', header: 'bg-amber-50 border-amber-200', count: 'bg-amber-100 text-amber-900', empty: 'border-amber-200' },
  { key: 'offer_made', label: 'Offer Made', accent: 'bg-teal-500', header: 'bg-teal-50 border-teal-200', count: 'bg-teal-100 text-teal-800', empty: 'border-teal-200' },
  { key: 'hired', label: 'Hired', accent: 'bg-emerald-500', header: 'bg-emerald-50 border-emerald-200', count: 'bg-emerald-100 text-emerald-800', empty: 'border-emerald-200' },
  { key: 'rejected', label: 'Rejected', accent: 'bg-rose-500', header: 'bg-rose-50 border-rose-200', count: 'bg-rose-100 text-rose-800', empty: 'border-rose-200' },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function formatApplied(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function nextInterview(interviews?: InterviewRound[]) {
  if (!interviews?.length) return null
  const upcoming = [...interviews]
    .filter(i => i.status === 'scheduled' && i.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  return upcoming[0] ?? interviews[interviews.length - 1]
}

function formatWhen(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function AddCandidateToJobModal({
  jobId, onClose,
}: { jobId: string; onClose: () => void }) {
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
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-lg max-h-[80vh]')} onClick={e => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">Add Candidate to Pipeline</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="shrink-0 p-4 border-b">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No candidates found.</div>
          ) : filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={async () => {
                await create.mutateAsync({ candidate_id: c.id, job_posting_id: jobId, current_stage: 'applied' })
                onClose()
              }}
              className="w-full text-left px-4 py-3 hover:bg-accent border-b border-border flex items-center gap-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(c.full_name)}
              </span>
              <span className="min-w-0">
                <p className="text-sm font-medium truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.email ?? c.phone ?? c.current_designation ?? '—'}
                </p>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScheduleInterviewModal({
  application, onClose,
}: { application: JobApplication; onClose: () => void }) {
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
    <div data-kiterp-modal className={dialogOverlayClass}>
      <div className={cn(dialogPanelClass, 'max-w-md')}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h2 className="text-lg font-semibold">Schedule Interview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {application.candidate?.full_name ?? 'Candidate'}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-3 p-5">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Round Name</Label>
              <input
                value={form.round_name}
                onChange={e => setForm({ ...form, round_name: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">When</Label>
              <input
                type="datetime-local"
                required
                value={form.scheduled_at}
                onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Duration (min)</Label>
                <input
                  type="number"
                  value={form.duration_min}
                  onChange={e => setForm({ ...form, duration_min: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Mode</Label>
                <Select
                  value={form.mode}
                  onChange={v => setForm({ ...form, mode: v })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                  options={[
                    { value: 'video', label: 'Video' },
                    { value: 'phone', label: 'Phone' },
                    { value: 'onsite', label: 'Onsite' },
                  ]}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                Interview link / location{form.mode === 'video' ? ' *' : ''}
              </Label>
              <input
                value={form.location_or_link}
                onChange={e => setForm({ ...form, location_or_link: e.target.value })}
                required={form.mode === 'video'}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
                placeholder={form.mode === 'onsite' ? 'Office / room' : 'https://meet.google.com/…'}
              />
            </div>
          </div>
          <div className="shrink-0 flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Schedule'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STAGE_SELECT_LABEL: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screen',
  shortlisted: 'Shortlist',
  interviewing: 'Interview',
  offer_made: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}

const metaChipClass =
  'inline-flex max-w-full items-center gap-0.5 rounded bg-muted/80 px-1 py-px text-[9px] leading-3 text-muted-foreground'

const actionBtnClass =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground'

function PipelineCard({
  app,
  onMove,
  onSchedule,
  moving,
  highlighted,
}: {
  app: JobApplication
  onMove: (stage: string) => void
  onSchedule: () => void
  moving?: boolean
  highlighted?: boolean
}) {
  const c = app.candidate
  const name = c?.full_name ?? '—'
  const titleLine = [c?.current_designation, c?.current_company].filter(Boolean).join(' · ')
  const applied = formatApplied(app.applied_at)
  const subtitle = [titleLine, applied ? `Applied ${applied}` : null].filter(Boolean).join(' · ')
  const interview = nextInterview(app.interviews)
  const when = formatWhen(interview?.scheduled_at)
  const skill = (c?.skills ?? [])[0]
  const extraSkills = Math.max(0, (c?.skills?.length ?? 0) - 1)
  const hasMeta =
    c?.total_experience_years != null ||
    !!c?.location ||
    c?.notice_period_days != null ||
    !!skill

  return (
    <div
      id={`pipeline-application-${app.id}`}
      className={cn(
        'group flex flex-col gap-1 rounded-lg border bg-card px-2 py-1.5 shadow-sm transition hover:border-primary/30 hover:shadow-md',
        highlighted
          ? 'border-primary ring-2 ring-primary/40 ring-offset-1 shadow-md'
          : 'border-border',
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-xs font-semibold leading-4 text-foreground" title={name}>
              {name}
            </p>
            {app.rating ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-medium text-amber-600">
                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                {app.rating}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="truncate text-[10px] leading-3 text-muted-foreground" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {hasMeta ? (
        <div className="flex flex-wrap gap-0.5">
          {c?.total_experience_years != null ? (
            <span className={metaChipClass}>
              <Briefcase className="h-2 w-2 shrink-0" />
              {c.total_experience_years}y
            </span>
          ) : null}
          {c?.location ? (
            <span className={cn(metaChipClass, 'max-w-[5.5rem] truncate')}>
              <MapPin className="h-2 w-2 shrink-0" />
              {c.location}
            </span>
          ) : null}
          {c?.notice_period_days != null ? (
            <span className={metaChipClass}>
              <Clock className="h-2 w-2 shrink-0" />
              {c.notice_period_days}d
            </span>
          ) : null}
          {skill ? (
            <span
              className="inline-flex max-w-[6.5rem] truncate rounded border border-border/70 bg-background px-1 py-px text-[9px] leading-3 text-foreground/80"
              title={skill}
            >
              {skill}
            </span>
          ) : null}
          {extraSkills > 0 ? (
            <span className="self-center text-[9px] text-muted-foreground">+{extraSkills}</span>
          ) : null}
        </div>
      ) : null}

      {(app.interviews?.length || when) ? (
        <div className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] leading-3 text-amber-900">
          <div className="flex items-center gap-0.5 font-medium">
            <UsersIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {app.interviews?.length ?? 0} rnd{(app.interviews?.length ?? 0) === 1 ? '' : 's'}
              {interview?.round_name ? ` · ${interview.round_name}` : ''}
              {when ? ` · ${when}` : ''}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-0.5 border-t border-border/60 pt-1">
        <Select
          value={app.current_stage}
          onChange={onMove}
          disabled={moving}
          className="min-w-0 flex-1"
          triggerClassName="!h-6 !min-h-6 !px-1.5 !py-0 !text-[10px] !leading-none"
          menuMinWidth={120}
          options={STAGES.map(s => ({
            value: s.key,
            label: STAGE_SELECT_LABEL[s.key] ?? s.label,
          }))}
        />
        <button
          type="button"
          onClick={onSchedule}
          className={cn(actionBtnClass, 'text-primary hover:bg-primary/10')}
          title="Schedule interview"
        >
          <Calendar className="h-3 w-3" />
        </button>
        {c?.email ? (
          <a href={`mailto:${c.email}`} className={actionBtnClass} title={c.email}>
            <Mail className="h-3 w-3" />
          </a>
        ) : c?.phone ? (
          <a href={`tel:${c.phone}`} className={actionBtnClass} title={c.phone}>
            <Phone className="h-3 w-3" />
          </a>
        ) : null}
        {c?.resume_url ? (
          <a
            href={c.resume_url}
            target="_blank"
            rel="noreferrer"
            className={actionBtnClass}
            title="Open resume"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const focusStage = searchParams.get('stage')
  const focusApplicationId = searchParams.get('applicationId')
  const { data: job, isLoading } = useHRJob(id)
  const { data: applications = [] } = useHRApplications({ job_id: id })
  const moveStage = useMoveHRStage()
  const [showAdd, setShowAdd] = useState(false)
  const [scheduleFor, setScheduleFor] = useState<JobApplication | null>(null)

  const apps = applications as JobApplication[]

  const grouped = useMemo(() => {
    const g: Record<string, JobApplication[]> = {}
    STAGES.forEach(s => { g[s.key] = [] })
    apps.forEach(a => {
      ;(g[a.current_stage] ??= []).push(a)
    })
    return g
  }, [apps])

  const validFocusStage =
    focusStage && STAGES.some(s => s.key === focusStage) ? focusStage : null

  useEffect(() => {
    if (!validFocusStage && !focusApplicationId) return

    const scrollTarget = () => {
      if (focusApplicationId) {
        const card = document.getElementById(`pipeline-application-${focusApplicationId}`)
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
          return true
        }
      }
      if (validFocusStage) {
        document
          .getElementById(`pipeline-stage-${validFocusStage}`)
          ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        return true
      }
      return false
    }

    if (scrollTarget()) return
    const retry = window.setInterval(() => {
      if (scrollTarget()) window.clearInterval(retry)
    }, 150)
    const stop = window.setTimeout(() => window.clearInterval(retry), 3000)
    return () => {
      window.clearInterval(retry)
      window.clearTimeout(stop)
    }
  }, [validFocusStage, focusApplicationId, id, apps.length])

  const totalInPipeline = apps.filter(a => a.current_stage !== 'rejected' && a.current_stage !== 'withdrawn').length
  const hiredCount = grouped.hired?.length ?? 0
  const interviewingCount = grouped.interviewing?.length ?? 0
  const rejectedCount = grouped.rejected?.length ?? 0

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (!job) return <div className="p-6 text-muted-foreground">Job not found.</div>

  return (
    <div className="flex h-full min-h-0 flex-col p-4 md:p-6">
      <Link
        to="/hr/recruitment"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to recruitment
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">{job.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[job.department?.name, job.designation?.name, job.location]
              .filter(Boolean)
              .join(' · ') || '—'}
            {' · '}
            {job.openings} opening{job.openings === 1 ? '' : 's'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
              {totalInPipeline} in pipeline
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
              {interviewingCount} interviewing
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
              {hiredCount} hired
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-800">
              {rejectedCount} rejected
            </span>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} className="shrink-0 gap-1.5">
          <Plus className="w-4 h-4" /> Add to pipeline
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
        <div className="flex h-full min-h-[420px] gap-3" style={{ minWidth: STAGES.length * 220 }}>
          {STAGES.map(stage => {
            const items = grouped[stage.key] ?? []
            return (
              <div
                key={stage.key}
                id={`pipeline-stage-${stage.key}`}
                className={cn(
                  'flex w-[210px] shrink-0 flex-col rounded-xl border transition-shadow',
                  stage.header,
                  validFocusStage === stage.key && !focusApplicationId && 'ring-2 ring-primary ring-offset-2 shadow-md',
                )}
              >
                <div className="flex items-center gap-2 border-b border-inherit px-2.5 py-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', stage.accent)} />
                  <h3 className="flex-1 text-[11px] font-bold uppercase tracking-wide text-foreground/80">
                    {stage.label}
                  </h3>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', stage.count)}>
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto p-1.5">
                  {items.length === 0 ? (
                    <div
                      className={cn(
                        'flex h-24 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground',
                        stage.empty,
                      )}
                    >
                      No candidates
                    </div>
                  ) : (
                    items.map(app => (
                      <PipelineCard
                        key={app.id}
                        app={app}
                        highlighted={focusApplicationId === app.id}
                        moving={moveStage.isPending}
                        onMove={v => moveStage.mutate({ id: app.id, stage: v })}
                        onSchedule={() => setScheduleFor(app)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showAdd && <AddCandidateToJobModal jobId={id} onClose={() => setShowAdd(false)} />}
      {scheduleFor && (
        <ScheduleInterviewModal application={scheduleFor} onClose={() => setScheduleFor(null)} />
      )}
    </div>
  )
}
