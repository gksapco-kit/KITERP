import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, X, BookOpen, Video, FileText, HelpCircle } from 'lucide-react'
import {
  useHRProgram, useCreateHRCourse, useUpdateHRCourse, useDeleteHRCourse,
} from '@/hooks/useVendor'
import type { TrainingProgram, TrainingCourse, QuizQuestion, QuizOption } from '@/types'

const CONTENT_ICONS: Record<string, React.ElementType> = {
  text: FileText, video: Video, pdf: FileText, quiz: HelpCircle, scorm: BookOpen,
}

export default function ProgramDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, isLoading } = useHRProgram(id)
  const del = useDeleteHRCourse()
  const [editing, setEditing] = useState<TrainingCourse | null>(null)
  const [showNew, setShowNew] = useState(false)

  if (isLoading || !data) return <div className="p-6 text-gray-400">Loading…</div>
  const p = data as TrainingProgram
  const courses = (p.courses ?? []).slice().sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/hr/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to programs
      </Link>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{p.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {p.category ?? 'General'} · {p.estimated_hours ?? 0}h ·{' '}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>{p.status}</span>
            {p.is_mandatory && <span className="ml-2 text-orange-600 text-xs font-medium">Mandatory</span>}
          </p>
          {p.description && <p className="text-sm text-gray-600 mt-2 max-w-2xl">{p.description}</p>}
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Course
        </button>
      </div>

      <div className="space-y-3">
        {courses.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center" onClick={e => e.stopPropagation()}>
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No courses yet. Add the first lesson or quiz.</p>
          </div>
        ) : (
          courses.map((c, idx) => {
            const Icon = CONTENT_ICONS[c.content_type] ?? FileText
            return (
              <div key={c.id} className="bg-white border rounded-xl shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-gray-500" />
                      <h3 className="font-medium text-gray-900">{c.title}</h3>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                        {c.content_type}
                      </span>
                      {c.is_required && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Required</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {c.duration_min ? <>{c.duration_min} min · </> : null}
                      {c.content_type === 'quiz' ? <>{c.questions?.length ?? 0} questions · Pass {c.pass_score_pct ?? 70}%</> : c.content_url ?? ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(c)} className="p-1.5 text-gray-400 hover:text-blue-600">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete course "${c.title}"?`)) del.mutate(c.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {(showNew || editing) && (
        <CourseModal programId={p.id} course={editing}
          nextSequence={(courses[courses.length - 1]?.sequence ?? 0) + 1}
          onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function CourseModal({
  programId, course, nextSequence, onClose,
}: {
  programId: string; course: TrainingCourse | null; nextSequence: number; onClose: () => void
}) {
  const create = useCreateHRCourse()
  const update = useUpdateHRCourse()
  const [form, setForm] = useState<{
    title: string; sequence: number; content_type: TrainingCourse['content_type'];
    content_url: string; body_html: string; duration_min: string;
    pass_score_pct: number; is_required: boolean;
  }>({
    title:           course?.title ?? '',
    sequence:        course?.sequence ?? nextSequence,
    content_type:    course?.content_type ?? 'text',
    content_url:     course?.content_url ?? '',
    body_html:       course?.body_html ?? '',
    duration_min:    course?.duration_min != null ? String(course.duration_min) : '',
    pass_score_pct:  course?.pass_score_pct ?? 70,
    is_required:     course?.is_required ?? true,
  })
  const [questions, setQuestions] = useState<QuizQuestion[]>(course?.questions ?? [])

  const submit = () => {
    const payload: Record<string, unknown> = {
      ...form,
      duration_min: form.duration_min === '' ? null : Number(form.duration_min),
      pass_score_pct: Number(form.pass_score_pct),
      questions: form.content_type === 'quiz' ? questions : undefined,
    }
    if (course) update.mutate({ id: course.id, data: payload }, { onSuccess: onClose })
    else        create.mutate({ programId, data: payload }, { onSuccess: onClose })
  }

  const addQuestion = () => {
    setQuestions([...questions, {
      id: `tmp-${Date.now()}`,
      course_id: course?.id ?? '',
      sequence: questions.length + 1,
      question: '',
      question_type: 'single',
      options: [{ id: `o-${Date.now()}-1`, text: '' }, { id: `o-${Date.now()}-2`, text: '' }],
      points: 1,
    }])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold">{course ? 'Edit Course' : 'Add Course'}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Title *">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sequence">
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" value={form.sequence}
                onChange={e => setForm({ ...form, sequence: Number(e.target.value) })} />
            </Field>
            <Field label="Type">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.content_type}
                onChange={e => setForm({ ...form, content_type: e.target.value as TrainingCourse['content_type'] })}>
                <option value="text">Text / Article</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="quiz">Quiz</option>
                <option value="scorm">SCORM</option>
              </select>
            </Field>
            <Field label="Duration (min)">
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={form.duration_min} onChange={e => setForm({ ...form, duration_min: e.target.value })} />
            </Field>
          </div>
          {form.content_type !== 'quiz' && form.content_type !== 'text' && (
            <Field label="Content URL">
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.content_url}
                onChange={e => setForm({ ...form, content_url: e.target.value })}
                placeholder="https://… or YouTube / Vimeo URL" />
            </Field>
          )}
          {form.content_type === 'text' && (
            <Field label="Body (HTML)">
              <textarea className="w-full border rounded px-3 py-2 text-sm font-mono" rows={6}
                value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pass score %">
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={form.pass_score_pct} onChange={e => setForm({ ...form, pass_score_pct: Number(e.target.value) })} />
            </Field>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" checked={form.is_required}
                onChange={e => setForm({ ...form, is_required: e.target.checked })} />
              Required for completion
            </label>
          </div>

          {form.content_type === 'quiz' && (
            <div className="border-t pt-3 mt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Quiz Questions</h3>
                <button onClick={addQuestion}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
                  <Plus className="w-3 h-3" /> Add question
                </button>
              </div>
              <div className="space-y-3">
                {questions.map((q, qi) => (
                  <div key={q.id} className="border rounded p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Q{qi + 1}</span>
                      <button onClick={() => setQuestions(questions.filter(x => x.id !== q.id))}
                        className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <input className="w-full border rounded px-2 py-1 text-sm mb-2"
                      placeholder="Question text" value={q.question}
                      onChange={e => setQuestions(questions.map(x => x.id === q.id ? { ...x, question: e.target.value } : x))} />
                    <div className="flex gap-2 mb-2">
                      <select className="border rounded px-2 py-1 text-xs" value={q.question_type}
                        onChange={e => setQuestions(questions.map(x =>
                          x.id === q.id ? { ...x, question_type: e.target.value as QuizQuestion['question_type'] } : x))}>
                        <option value="single">Single answer</option>
                        <option value="multi">Multiple answers</option>
                        <option value="true_false">True / False</option>
                      </select>
                      <input type="number" className="border rounded px-2 py-1 text-xs w-20" placeholder="Points"
                        value={q.points ?? 1} onChange={e => setQuestions(questions.map(x =>
                          x.id === q.id ? { ...x, points: Number(e.target.value) } : x))} />
                    </div>
                    <div className="space-y-1">
                      {(q.options ?? []).map((opt, oi) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input type={q.question_type === 'multi' ? 'checkbox' : 'radio'}
                            checked={opt.is_correct ?? false}
                            onChange={() => setQuestions(questions.map(x => {
                              if (x.id !== q.id) return x
                              const opts = (x.options ?? []).map((o, i) =>
                                q.question_type === 'multi'
                                  ? (i === oi ? { ...o, is_correct: !o.is_correct } : o)
                                  : { ...o, is_correct: i === oi })
                              return { ...x, options: opts }
                            }))} />
                          <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder={`Option ${oi + 1}`}
                            value={opt.text} onChange={e => setQuestions(questions.map(x => x.id === q.id
                              ? { ...x, options: (x.options ?? []).map((o, i) => i === oi ? { ...o, text: e.target.value } : o) }
                              : x))} />
                          <button type="button" aria-label="Close" onClick={() => setQuestions(questions.map(x => x.id === q.id
                            ? { ...x, options: (x.options ?? []).filter((_, i) => i !== oi) } : x))}
                            className="text-red-400 hover:text-red-600">
                <X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => setQuestions(questions.map(x => x.id === q.id
                        ? { ...x, options: [...(x.options ?? []), { id: `o-${Date.now()}`, text: '' } as QuizOption] } : x))}
                        className="text-xs text-blue-600 hover:underline">+ Add option</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg text-gray-700">Cancel</button>
          <button onClick={submit} disabled={!form.title.trim() || create.isPending || update.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {course ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
