import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useTeamMembers } from '@/hooks/useVendor'
import { useProcurementFieldConfig } from '@/hooks/useProcurementFieldConfig'
import type { DocType } from '@/lib/procurementFieldCatalog'

interface Props {
  primaryApproverId: string
  secondaryApproverId: string
  approverMessage: string
  onPrimaryChange: (id: string) => void
  onSecondaryChange: (id: string) => void
  onMessageChange: (value: string) => void
  /** WF_PR | WF_PO | WF_INVOICE — drives field visibility from Approval Workflow config */
  docType?: DocType
  inline?: boolean
  compact?: boolean
  className?: string
}

const fieldClass = 'mt-0.5 h-8 text-xs py-0 px-2.5'

export function ProcurementApproverFields({
  primaryApproverId,
  secondaryApproverId,
  approverMessage,
  onPrimaryChange,
  onSecondaryChange,
  onMessageChange,
  docType,
  inline = false,
  compact = false,
  className,
}: Props) {
  const { data: teamData, isLoading } = useTeamMembers({ size: 200 })
  const members = (teamData?.items ?? []).filter(m => m.is_active)
  const { getStatus } = useProcurementFieldConfig()

  // When a docType is provided, honour the Approval Workflow field config.
  // Undefined docType means the component is used in a context where all fields
  // should always be shown (e.g. inside a settings page itself).
  const fieldStatus = (key: string) =>
    docType ? getStatus(docType, key) : 'optional'

  const showPrimary   = fieldStatus('approver') !== 'suppress'
  const showSecondary = fieldStatus('secondary_approver') !== 'suppress'
  const showMessage   = fieldStatus(docType === 'WF_PR' ? 'approval_message' : 'approver_message') !== 'suppress'

  const primaryRequired   = fieldStatus('approver') === 'mandatory'
  const secondaryRequired = fieldStatus('secondary_approver') === 'mandatory'
  const messageRequired   = fieldStatus(docType === 'WF_PR' ? 'approval_message' : 'approver_message') === 'mandatory'

  const teamOptions = members.map(m => ({
    value: m.id,
    label: m.user?.full_name
      ? `${m.user.full_name}${m.user.email ? ` · ${m.user.email}` : ''} (${m.role_name})`
      : m.role_name || 'Team member',
  }))

  const secondaryOptions = teamOptions.filter(o => o.value !== primaryApproverId)
  const labelClass = inline || compact ? 'text-[11px] leading-tight text-gray-500' : 'text-xs'

  const primaryField = showPrimary ? (
    <div>
      <Label className={labelClass}>
        Primary Approver{primaryRequired && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Select
        value={primaryApproverId}
        onChange={onPrimaryChange}
        options={selectOptionsWithBlank(
          isLoading ? 'Loading…' : 'Select approver…',
          teamOptions,
        )}
        placeholder={isLoading ? 'Loading…' : 'Select approver…'}
        disabled={isLoading}
        className={inline || compact ? fieldClass : 'mt-1'}
        aria-label="Primary approver"
        aria-required={primaryRequired}
      />
    </div>
  ) : null

  const secondaryField = showSecondary ? (
    <div>
      <Label className={labelClass}>
        Secondary Approver{secondaryRequired && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Select
        value={secondaryApproverId}
        onChange={onSecondaryChange}
        options={selectOptionsWithBlank(
          'None (single-level approval)',
          secondaryOptions,
        )}
        placeholder="None (single-level approval)"
        disabled={isLoading || !primaryApproverId}
        className={inline || compact ? fieldClass : 'mt-1'}
        aria-label="Secondary approver"
        aria-required={secondaryRequired}
      />
    </div>
  ) : null

  const messageField = showMessage ? (
    <div>
      <Label className={labelClass}>
        Message for Approver{messageRequired && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {inline || compact ? (
        <Input
          value={approverMessage}
          onChange={e => onMessageChange(e.target.value)}
          placeholder="Context for approver…"
          className={fieldClass}
          required={messageRequired}
        />
      ) : (
        <textarea
          className="mt-1 w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={approverMessage}
          onChange={e => onMessageChange(e.target.value)}
          placeholder="Context, justification, or urgency notes for the approver…"
          required={messageRequired}
        />
      )}
    </div>
  ) : null

  // If all fields are suppressed there's nothing to show
  if (!showPrimary && !showSecondary && !showMessage) return null

  if (inline) {
    return (
      <>
        {showPrimary   && <div className="col-span-12 sm:col-span-6 lg:col-span-3">{primaryField}</div>}
        {showSecondary && <div className="col-span-12 sm:col-span-6 lg:col-span-3">{secondaryField}</div>}
        {showMessage   && <div className="col-span-12 sm:col-span-6 lg:col-span-3">{messageField}</div>}
      </>
    )
  }

  return (
    <div className={`${compact ? 'space-y-1.5' : 'space-y-3'} ${className ?? ''}`}>
      {!compact && <h3 className="font-medium text-sm">Approver Details</h3>}
      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-1.5`}>
        {primaryField}
        {secondaryField}
        {compact && messageField}
      </div>
      {!compact && messageField}
      {!isLoading && members.length === 0 && (
        <p className="text-[11px] text-amber-600">No team members found — invite staff under Settings → Team first.</p>
      )}
    </div>
  )
}
