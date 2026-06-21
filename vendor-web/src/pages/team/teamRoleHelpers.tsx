import type { VendorRole } from '@/types'
import { Select } from '@/components/ui/select'

export type AssignableTeamRoles = {
  builtin_roles: { slug: string; name: string }[]
  custom_roles: VendorRole[]
}

export function roleSelectValue(member: { role: string; role_id?: string | null }) {
  return member.role === 'custom' ? (member.role_id || '') : member.role
}

export function parseRoleSelectValue(
  val: string,
  customRoles: VendorRole[],
): { role: string; role_id: string } {
  const isCustom = customRoles.some((r) => r.id === val)
  return { role: isCustom ? 'custom' : val, role_id: isCustom ? val : '' }
}

export function toDateInputValue(iso?: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function TeamRoleSelect({
  assignable,
  value,
  onChange,
  className = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white',
  disabled,
}: {
  assignable: AssignableTeamRoles | undefined
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}) {
  const builtin = assignable?.builtin_roles ?? []
  const custom = assignable?.custom_roles ?? []
  const activeCustom = custom.filter((r) => r.is_active)
  const inactiveCustom = custom.filter((r) => !r.is_active)

  const options = [
    ...builtin.map((r) => ({ value: r.slug, label: r.name, group: 'Built-in roles' })),
    ...activeCustom.map((r) => ({ value: r.id, label: r.name, group: 'Custom roles' })),
    ...inactiveCustom.map((r) => ({ value: r.id, label: `${r.name} (inactive)`, group: 'Custom roles (inactive)' })),
  ]

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      aria-label="Team role"
      className={className}
    />
  )
}

const wrap = 'div'

export function AccessWindowFields(props: {
  accessStartsAt: string
  accessEndsAt: string
  onAccessStartsAtChange: (v: string) => void
  onAccessEndsAtChange: (v: string) => void
  hrLwd?: string | null
  accessEndSource?: string | null
  accessSyncNote?: string | null
  onApplyHrLwd?: () => void
  disabled?: boolean
}) {
  const {
    accessStartsAt,
    accessEndsAt,
    onAccessStartsAtChange,
    onAccessEndsAtChange,
    hrLwd,
    accessEndSource,
    accessSyncNote,
    onApplyHrLwd,
    disabled,
  } = props
  const Box = wrap as 'div'

  return (
    <Box className="space-y-3">
      {accessSyncNote ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {accessSyncNote}
        </p>
      ) : null}
      <Box className="grid grid-cols-2 gap-3">
        <Box>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access start</label>
          <input
            type="date"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:opacity-60"
            value={accessStartsAt}
            onChange={(e) => onAccessStartsAtChange(e.target.value)}
          />
        </Box>
        <Box>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access end
            {accessEndSource === 'hr_lwd' ? (
              <span className="ml-1 text-xs font-normal text-amber-600">(from HR LWD)</span>
            ) : null}
          </label>
          <input
            type="date"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:opacity-60"
            value={accessEndsAt}
            onChange={(e) => onAccessEndsAtChange(e.target.value)}
          />
        </Box>
      </Box>
      {hrLwd && onApplyHrLwd ? (
        <Box className="flex items-center justify-between gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="text-blue-800">
            HR Last working day: <strong>{hrLwd}</strong>
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={onApplyHrLwd}
            className="shrink-0 text-blue-700 font-medium hover:underline disabled:opacity-50"
          >
            Use as access end
          </button>
        </Box>
      ) : null}
    </Box>
  )
}
