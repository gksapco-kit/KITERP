export function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 m-0">
      <Icon className="w-4 h-4 text-gray-400" /> {children}
    </p>
  )
}

export function MetricTile({
  label, value, sub, icon: Icon,
}: { label: string; value: string; sub?: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-lg border bg-background px-4 py-2 min-w-[8rem]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 capitalize">{sub}</p>}
    </div>
  )
}
