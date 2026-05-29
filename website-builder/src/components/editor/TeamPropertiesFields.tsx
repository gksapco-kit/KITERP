import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { clampIntervalSeconds, normalizeTeamLayout } from '../../lib/sectionSlider'
import { createDefaultTeamMember, resolveTeamMembers, TEAM_DISPLAY_DEFAULTS } from '../../lib/teamDefaults'
import type { Block, TeamMemberItem } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ItemContentStyleFields } from './ItemContentStyleFields'
import { SliderLayoutFields } from './SliderLayoutFields'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface TeamPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

export function TeamPropertiesFields({ block, onChange }: TeamPropertiesFieldsProps) {
  const p = block.props
  const members = p.teamMembers?.length ? p.teamMembers : resolveTeamMembers(p)
  const [expanded, setExpanded] = useState<number | null>(members.length > 0 ? 0 : null)

  const updateMembers = (next: TeamMemberItem[]) => onChange({ teamMembers: next, cards: undefined })

  const updateMember = (index: number, member: TeamMemberItem) => {
    const next = [...members]
    next[index] = member
    updateMembers(next)
  }

  const removeMember = (index: number) => {
    updateMembers(members.filter((_, i) => i !== index))
    if (expanded === index) setExpanded(null)
    else if (expanded != null && expanded > index) setExpanded(expanded - 1)
  }

  const duplicateMember = (index: number) => {
    const m = members[index]
    if (!m) return
    const copy = { ...m, id: uuid(), name: m.name ? `${m.name} (copy)` : '' }
    const next = [...members]
    next.splice(index + 1, 0, copy)
    updateMembers(next)
    setExpanded(index + 1)
  }

  const addMember = () => {
    const next = [...members, createDefaultTeamMember()]
    updateMembers(next)
    setExpanded(next.length - 1)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Team members</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Meet Our Team" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="The people behind our work" />
      </Field>

      <SliderLayoutFields
        layout={normalizeTeamLayout(p.teamLayout ?? TEAM_DISPLAY_DEFAULTS.teamLayout)}
        layoutOptions={[
          { value: 'grid', label: 'Grid' },
          { value: 'manualSlider', label: 'Manual slider' },
          { value: 'autoSlider', label: 'Auto slider' },
        ]}
        onLayoutChange={(teamLayout) =>
          onChange({ teamLayout: teamLayout as 'grid' | 'manualSlider' | 'autoSlider' })
        }
        intervalSeconds={p.sliderIntervalSeconds}
        onIntervalChange={(sliderIntervalSeconds) =>
          onChange({ sliderIntervalSeconds: clampIntervalSeconds(sliderIntervalSeconds) })
        }
        columns={p.columns ?? 4}
        onColumnsChange={(columns) => onChange({ columns })}
        columnsMin={2}
        columnsMax={4}
        showColumnsWhen={['grid', 'manualSlider', 'autoSlider']}
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Display</p>
        <ToggleField label="Show bio" checked={p.showTeamBio ?? TEAM_DISPLAY_DEFAULTS.showTeamBio} onChange={(v) => onChange({ showTeamBio: v })} />
        <ToggleField label="Show email button" checked={!!p.showTeamEmail} onChange={(v) => onChange({ showTeamEmail: v })} />
        <ToggleField label="Show social link" checked={p.showTeamSocial ?? TEAM_DISPLAY_DEFAULTS.showTeamSocial} onChange={(v) => onChange({ showTeamSocial: v })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Members ({members.length})</span>
          <button type="button" onClick={addMember} className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
            <Plus className="h-3.5 w-3.5" /> Add member
          </button>
        </div>

        <ul className="space-y-2">
          {members.map((member, i) => {
            const isOpen = expanded === i
            return (
              <li key={member.id ?? i} className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1 p-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium text-gray-800" onClick={() => setExpanded(isOpen ? null : i)}>
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{member.name || `Member ${i + 1}`}</span>
                  </button>
                  <button type="button" title="Duplicate" className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => duplicateMember(i)}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" title="Delete" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeMember(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-3">
                    <Field label="Name">
                      <input className={inputClass} value={member.name} onChange={(e) => updateMember(i, { ...member, name: e.target.value })} />
                    </Field>
                    <Field label="Role / title">
                      <input className={inputClass} value={member.role} onChange={(e) => updateMember(i, { ...member, role: e.target.value })} />
                    </Field>
                    <Field label="Bio">
                      <textarea className={inputClass} rows={3} value={member.bio ?? ''} onChange={(e) => updateMember(i, { ...member, bio: e.target.value })} />
                    </Field>
                    <ImageUploadField label="Photo" value={member.imageUrl} onChange={(url) => updateMember(i, { ...member, imageUrl: url })} />
                    <Field label="Email (optional)">
                      <input className={inputClass} type="email" value={member.email ?? ''} onChange={(e) => updateMember(i, { ...member, email: e.target.value })} />
                    </Field>
                    <Field label="Social / profile link">
                      <input className={inputClass} value={member.socialLink ?? ''} onChange={(e) => updateMember(i, { ...member, socialLink: e.target.value })} placeholder="https://linkedin.com/in/..." />
                    </Field>
                    <ItemContentStyleFields
                      style={member.contentStyle}
                      onChange={(contentStyle) => updateMember(i, { ...member, contentStyle })}
                      titleLabel="Name color"
                      descriptionLabel="Role / bio color"
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
