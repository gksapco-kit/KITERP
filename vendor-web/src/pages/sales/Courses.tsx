import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, GraduationCap, ToggleLeft, ToggleRight, X, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { AiDescriptionTextarea } from '@/components/common/AiDescriptionTextarea'
import { ResizableTable } from '@/components/table/ResizableTable'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CheckboxFieldLabel, TableColumnLabel } from '@/components/common/FieldLabel'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { resolveBusinessGalleryDisplayUrl } from '@/data/businessImagePack'
import { cn, formatCurrency, isLikelyImageFile, mediaUrl } from '@/lib/utils'
import { modalWidthLg } from '@/lib/modalUi'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useToggleCourseActive,
} from '@/hooks/useCourses'
import { coursesApi } from '@/api/courses'
import type { VendorCourse, VendorCourseCreate, CourseSyllabusWeek, CoursePerk } from '@/api/courses'

import { askConfirm } from '@/components/common/ConfirmProvider'
const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const PERK_ICONS = ['clock', 'video', 'award', 'users']

function SyllabusEditor({
  items,
  onChange,
}: {
  items: CourseSyllabusWeek[]
  onChange: (next: CourseSyllabusWeek[]) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-[50px_1fr_60px_70px_28px] gap-1.5 items-center">
          <Input
            type="number"
            min={1}
            value={row.week}
            onChange={e => onChange(items.map((r, idx) => idx === i ? { ...r, week: Number(e.target.value) || 1 } : r))}
            className="h-8 text-xs"
            title="Week #"
          />
          <Input
            value={row.title}
            onChange={e => onChange(items.map((r, idx) => idx === i ? { ...r, title: e.target.value } : r))}
            placeholder="Week title"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            min={0}
            value={row.lessons ?? 0}
            onChange={e => onChange(items.map((r, idx) => idx === i ? { ...r, lessons: Number(e.target.value) || 0 } : r))}
            className="h-8 text-xs"
            title="Lessons"
          />
          <Input
            value={row.duration ?? ''}
            onChange={e => onChange(items.map((r, idx) => idx === i ? { ...r, duration: e.target.value } : r))}
            placeholder="1h 50m"
            className="h-8 text-xs"
          />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="rounded p-1 hover:bg-muted text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { week: items.length + 1, title: '', lessons: 0, duration: '' }])}
        className="h-7 gap-1 px-2 text-xs"
      >
        <Plus className="h-3 w-3" /> Add week
      </Button>
    </div>
  )
}

function PerksEditor({
  items,
  onChange,
}: {
  items: CoursePerk[]
  onChange: (next: CoursePerk[]) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-[90px_1fr_28px] gap-1.5 items-center">
          <select
            value={row.icon ?? 'clock'}
            onChange={e => onChange(items.map((r, idx) => idx === i ? { ...r, icon: e.target.value } : r))}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          >
            {PERK_ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
          </select>
          <Input
            value={row.text}
            onChange={e => onChange(items.map((r, idx) => idx === i ? { ...r, text: e.target.value } : r))}
            placeholder="Certificate of completion"
            className="h-8 text-xs"
          />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="rounded p-1 hover:bg-muted text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { icon: 'clock', text: '' }])}
        className="h-7 gap-1 px-2 text-xs"
      >
        <Plus className="h-3 w-3" /> Add perk
      </Button>
    </div>
  )
}

function CourseModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: VendorCourse
  onClose: () => void
  onSave: (data: VendorCourseCreate) => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [instructor, setInstructor] = useState(initial?.instructor ?? '')
  const [level, setLevel] = useState(initial?.level ?? 'Beginner')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [duration, setDuration] = useState(initial?.duration ?? '')
  const [lessons, setLessons] = useState(String(initial?.lessons ?? 0))
  const [rating, setRating] = useState(String(initial?.rating ?? 4.8))
  const [reviews, setReviews] = useState(String(initial?.reviews ?? 0))
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [imageUploading, setImageUploading] = useState(false)
  const localPreviewRef = useRef<string | null>(null)
  const [outcomesText, setOutcomesText] = useState((initial?.outcomes ?? []).join('\n'))
  const [syllabus, setSyllabus] = useState<CourseSyllabusWeek[]>(initial?.syllabus ?? [])
  const [perks, setPerks] = useState<CoursePerk[]>(initial?.perks ?? [])
  const [enrolledLabel, setEnrolledLabel] = useState(initial?.enrolled_label ?? '')
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Enroll for')
  const [previewCtaLabel, setPreviewCtaLabel] = useState(initial?.preview_cta_label ?? 'Try free preview')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const clearLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current)
      localPreviewRef.current = null
    }
  }

  const handleImageFile = async (file: File) => {
    if (!isLikelyImageFile(file)) {
      toast.error('Please choose an image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    clearLocalPreview()
    const localPreview = URL.createObjectURL(file)
    localPreviewRef.current = localPreview
    setImageUrl(localPreview)
    setImageUploading(true)
    try {
      const data = await coursesApi.uploadImage(file)
      const saved = data.image_url || data.url
      if (!saved) throw new Error('No image URL returned')
      clearLocalPreview()
      setImageUrl(saved)
      toast.success('Image uploaded')
    } catch {
      clearLocalPreview()
      setImageUrl(initial?.image_url ?? null)
      toast.error('Upload failed — try again or pick another image')
    } finally {
      setImageUploading(false)
    }
  }

  const handleImageUrl = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    clearLocalPreview()
    setImageUrl(trimmed)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (imageUrl?.startsWith('blob:')) {
      toast.error('Image is still uploading — wait a moment and try again')
      return
    }
    onSave({
      title: title.trim(),
      instructor: instructor.trim() || undefined,
      level,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      duration: duration.trim() || undefined,
      lessons: Number(lessons) || 0,
      rating: Number(rating) || 0,
      reviews: Number(reviews) || 0,
      price: price.trim() ? Number(price) : null,
      currency: currency.trim() || 'USD',
      image_url: imageUrl || null,
      outcomes: outcomesText.split('\n').map(s => s.trim()).filter(Boolean),
      syllabus: syllabus.filter(s => s.title.trim()),
      perks: perks.filter(p => p.text.trim()),
      enrolled_label: enrolledLabel.trim() || undefined,
      cta_label: ctaLabel.trim() || 'Enroll for',
      preview_cta_label: previewCtaLabel.trim() || 'Try free preview',
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    })
  }

  const labelCls = 'text-[10px] leading-none'
  const fieldGap = 'space-y-0.5'
  const selectCls = 'h-7 w-full rounded-md border border-input bg-background px-2 text-xs'
  const inputCls = 'h-7 text-xs'
  const moreOpen = syllabus.length > 0 || perks.length > 0 || !!outcomesText.trim()

  return (
    <ModalOverlay onClose={onClose} className="z-[100] bg-black/60 p-1.5">
      <ModalPanel className={cn(modalWidthLg, 'max-h-[calc(100dvh-0.75rem)]')}>
        <ModalHeader
          title={initial ? 'Edit course' : 'New course'}
          onClose={onClose}
          className="border-0 px-3 py-2 [&>div>h2]:text-sm"
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-1.5 overflow-y-auto px-3 pb-2 pt-0">
            <div className="grid grid-cols-[3.75rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 items-end">
              <ImageSourcePicker
                title="Course cover image"
                uploading={imageUploading}
                onFile={handleImageFile}
                onUrl={handleImageUrl}
              >
                {({ open, uploading }) => (
                  <button
                    type="button"
                    onClick={open}
                    disabled={uploading}
                    aria-label="Add cover photo"
                    title="Cover photo"
                    className="flex h-7 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 hover:bg-muted/60 disabled:pointer-events-none"
                  >
                    {imageUrl ? (
                      <img
                        src={
                          imageUrl.startsWith('blob:')
                            ? imageUrl
                            : mediaUrl(resolveBusinessGalleryDisplayUrl(imageUrl))
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                )}
              </ImageSourcePicker>
              <div className={fieldGap}>
                <Label className={labelCls}>Title *</Label>
                <Input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="Foundations of Modern Ceramics" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Instructor</Label>
                <Input className={inputCls} value={instructor} onChange={e => setInstructor(e.target.value)} placeholder="Naomi Reyes" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Category</Label>
                <Input className={inputCls} value={category} onChange={e => setCategory(e.target.value)} placeholder="Craft" />
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Description (optional)</Label>
              <AiDescriptionTextarea
                value={description}
                onChange={setDescription}
                rows={1}
                className="min-h-[1.75rem] w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                placeholder="Wheel throwing, hand-building, and your first three glazed pieces."
                maxLength={2000}
                context={{
                  field_kind: 'course_description',
                  name: title,
                  category,
                  extra_context: { instructor, level, duration },
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              <div className={fieldGap}>
                <Label className={labelCls}>Level</Label>
                <select value={level} onChange={e => setLevel(e.target.value)} className={selectCls}>
                  {COURSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Duration</Label>
                <Input className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} placeholder="6 weeks" />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Lessons</Label>
                <Input className={inputCls} type="number" min={0} value={lessons} onChange={e => setLessons(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Price</Label>
                <Input className={inputCls} type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Currency</Label>
                <Input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Sort</Label>
                <Input className={inputCls} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              <div className={fieldGap}>
                <Label className={labelCls}>Rating</Label>
                <Input className={inputCls} type="number" min={0} max={5} step="0.1" value={rating} onChange={e => setRating(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Reviews</Label>
                <Input className={inputCls} type="number" min={0} value={reviews} onChange={e => setReviews(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Enroll button</Label>
                <Input className={inputCls} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Preview button</Label>
                <Input className={inputCls} value={previewCtaLabel} onChange={e => setPreviewCtaLabel(e.target.value)} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Enrolled note</Label>
                <Input className={inputCls} value={enrolledLabel} onChange={e => setEnrolledLabel(e.target.value)} placeholder="2,400+ enrolled" />
              </div>
            </div>

            <details className="rounded-md bg-muted/15 px-2 py-1" open={moreOpen}>
              <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                Outcomes, syllabus &amp; perks {moreOpen ? '' : '· optional'}
              </summary>
              <div className="mt-1.5 space-y-1.5">
                <div className={fieldGap}>
                  <Label className={labelCls}>Outcomes (one per line)</Label>
                  <textarea
                    value={outcomesText}
                    onChange={e => setOutcomesText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={'Throw a balanced cylinder, bowl, and mug\nMix and apply two reliable glazes'}
                  />
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <div>
                    <p className={cn(labelCls, 'mb-0.5 text-muted-foreground')}>Syllabus</p>
                    <SyllabusEditor items={syllabus} onChange={setSyllabus} />
                  </div>
                  <div>
                    <p className={cn(labelCls, 'mb-0.5 text-muted-foreground')}>What&apos;s included</p>
                    <PerksEditor items={perks} onChange={setPerks} />
                  </div>
                </div>
              </div>
            </details>
          </ModalBody>
          <ModalFooter className="items-center justify-between gap-2 border-0 bg-transparent px-3 py-2">
            <CheckboxFieldLabel
              label="Active on storefront"
              checked={isActive}
              onChange={setIsActive}
              labelClassName="text-xs"
            />
            <div className="flex gap-2">
              <Button type="button" variant="cancel" className="h-7 px-2.5 text-xs" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-7 px-2.5 text-xs" disabled={saving || !title.trim()}>
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {initial ? 'Save' : 'Create'}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

export default function SalesCoursesPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; course?: VendorCourse } | null>(null)
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useCourses({ size: 100, search: search.trim() || undefined })
  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()
  const deleteCourse = useDeleteCourse()
  const toggleActive = useToggleCourseActive()

  const rows = useMemo(() => {
    const items = data?.items ?? []
    return processRows(
      items,
      search,
      (c) => [c.title, c.instructor ?? '', c.category ?? '', c.level],
      sortKey,
      sortDir,
      {
        sort_order: (c) => c.sort_order,
        title: (c) => c.title,
        price: (c) => c.price ?? 0,
        rating: (c) => c.rating,
        level: (c) => c.level,
        is_active: (c) => (c.is_active ? 1 : 0),
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  const saving = createCourse.isPending || updateCourse.isPending
  const { isSaving, patchField } = useInlineFieldPatch(updateCourse)

  return (
    <div className="space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-lg font-semibold leading-tight">
            <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
            Course Catalog
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Storefront courses · syncs to Website Builder
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="h-8 gap-1.5 px-3 text-sm shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add course
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search courses…"
            sortOptions={[
              { value: 'sort_order', label: 'Order' },
              { value: 'title', label: 'Title' },
              { value: 'price', label: 'Price' },
              { value: 'rating', label: 'Rating' },
              { value: 'level', label: 'Level' },
              { value: 'is_active', label: 'Active' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            hint={INLINE_EDIT_HINT}
          />
          <div className="overflow-x-auto">
            <ResizableTable tableId="sales-courses-v1" defaultWidths={[64, 220, 140, 110, 100, 80, 90, 120]}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Order</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Course</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Instructor</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Price</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Level</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Rating</TableColumnLabel></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Active</TableColumnLabel></th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No courses yet. Add your first course to sync with the website builder.</td></tr>
                ) : rows.map(course => (
                  <tr
                    key={course.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={onClickableTableRow(() => setModal({ mode: 'edit', course }))}
                  >
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell type="number" value={course.sort_order} readOnly readOnlyMessage="Use the full editor to change sort order" title="Order">
                        {course.sort_order}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {course.image_url ? (
                          <img src={mediaUrl(course.image_url)} alt="" className="h-8 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-10 rounded bg-muted shrink-0" />
                        )}
                        <InlineEditCell
                          value={course.title}
                          saving={isSaving(course.id, 'title')}
                          validate={(v) => String(v).trim().length < 1 ? 'Title is required' : null}
                          onSave={(v) => patchField(course.id, 'title', String(v).trim())}
                          title="Edit course title"
                          className="-mx-1.5 min-w-0 flex-1"
                        >
                          <span className="line-clamp-1">{course.title}</span>
                        </InlineEditCell>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <InlineEditCell
                        value={course.instructor || ''}
                        saving={isSaving(course.id, 'instructor')}
                        onSave={(v) => patchField(course.id, 'instructor', String(v).trim() || null)}
                        title="Edit instructor"
                      >
                        {course.instructor || '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={course.price ?? 0}
                        min={0}
                        step="0.01"
                        saving={isSaving(course.id, 'price')}
                        validate={(v) => Number(v) < 0 ? 'Price must be 0 or more' : null}
                        onSave={(v) => patchField(course.id, 'price', Number(v) || null)}
                        title="Edit price"
                      >
                        {course.price != null ? formatCurrency(course.price, course.currency) : '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={course.level}
                        options={COURSE_LEVELS.map(l => ({ value: l, label: l }))}
                        saving={isSaving(course.id, 'level')}
                        onSave={(v) => patchField(course.id, 'level', v)}
                        title="Edit level"
                      >
                        {course.level}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="number"
                        value={course.rating}
                        readOnly
                        readOnlyMessage="Rating and reviews are managed in the full editor"
                        title="Rating"
                      >
                        {course.rating > 0 ? `${course.rating} (${course.reviews})` : '—'}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <InlineEditCell
                        type="select"
                        value={course.is_active ? 'true' : 'false'}
                        options={[
                          { value: 'true', label: 'Active' },
                          { value: 'false', label: 'Hidden' },
                        ]}
                        saving={isSaving(course.id, 'is_active')}
                        onSave={(v) => patchField(course.id, 'is_active', v === 'true')}
                        title="Edit active status"
                      >
                        {course.is_active ? <span className="text-green-700 font-medium">Active</span> : <span className="text-muted-foreground">Hidden</span>}
                      </InlineEditCell>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={course.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => {
                            e.stopPropagation()
                            toggleActive.mutate({ id: course.id, is_active: !course.is_active })
                          }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {course.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', course }) }}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={async e => {
                            e.stopPropagation()
                            if (await askConfirm(`Delete course "${course.title}"?`)) deleteCourse.mutate(course.id)
                          }}
                          className="rounded p-1 hover:bg-muted text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <CourseModal
          initial={modal.mode === 'edit' ? modal.course : undefined}
          onClose={() => setModal(null)}
          saving={saving}
          onSave={data => {
            if (modal.mode === 'edit' && modal.course) {
              updateCourse.mutate({ id: modal.course.id, data }, { onSuccess: () => setModal(null) })
            } else {
              createCourse.mutate(data, { onSuccess: () => setModal(null) })
            }
          }}
        />
      )}
    </div>
  )
}
