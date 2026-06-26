import { Label } from '@/components/ui/label'
import type { LogoShape } from '@/lib/invoiceTemplates'
import { LOGO_SHAPES } from '@/lib/invoiceTemplates'

export const LOGO_SHAPE_PREVIEW_CLASS: Record<LogoShape, string> = {
  square: 'rounded object-contain !w-12 !h-12',
  rounded: 'rounded-lg object-contain !w-12 !h-12',
  squircle: 'object-cover !w-12 !h-12 [border-radius:28%]',
  circle: 'rounded-full object-cover aspect-square !w-12 !h-12 !max-w-[3rem]',
  oval: 'rounded-full object-cover !w-14 !h-10 !max-w-[3.5rem]',
  pill: 'rounded-full object-contain !w-16 !h-10 !max-w-[4rem]',
  sharp: 'rounded-none object-contain !w-12 !h-12',
  diamond: 'object-cover !w-12 !h-12 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]',
  hexagon: 'object-cover !w-12 !h-12 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
  arch: 'object-cover !w-12 !h-12 [border-radius:50%_50%_6px_6px]',
  shield: 'object-cover !w-12 !h-[3.25rem] [clip-path:polygon(50%_0%,92%_12%,92%_58%,50%_100%,8%_58%,8%_12%)]',
}

function LogoShapeIcon({ shape, selected }: { shape: LogoShape; selected?: boolean }) {
  const fill = selected ? '#3b82f6' : '#cbd5e1'
  const stroke = selected ? '#2563eb' : '#9ca3af'
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="mx-auto">
      {shape === 'square' && (
        <rect x="6" y="6" width="20" height="20" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'rounded' && (
        <rect x="6" y="6" width="20" height="20" rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'squircle' && (
        <rect x="6" y="6" width="20" height="20" rx="7" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'circle' && (
        <circle cx="16" cy="16" r="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'oval' && (
        <ellipse cx="16" cy="16" rx="12" ry="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'pill' && (
        <rect x="4" y="11" width="24" height="10" rx="5" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'sharp' && (
        <rect x="6" y="6" width="20" height="20" rx="0" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'diamond' && (
        <polygon points="16,5 27,16 16,27 5,16" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'hexagon' && (
        <polygon points="16,4 26,9 26,23 16,28 6,23 6,9" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'arch' && (
        <path d="M8 24 V14 Q8 6 16 6 Q24 6 24 14 V24 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'shield' && (
        <path d="M16 4 L26 8 L26 18 Q26 24 16 28 Q6 24 6 18 L6 8 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
    </svg>
  )
}

export function LogoShapePicker({
  value,
  onChange,
  hint = 'Shape applies to the logo in the live preview and generated offer letters.',
}: {
  value: LogoShape
  onChange: (shape: LogoShape) => void
  hint?: string
}) {
  return (
    <div className="mt-3">
      <Label className="text-xs text-gray-500 mb-1.5 block">Logo shape</Label>
      <div className="flex flex-wrap gap-2">
        {LOGO_SHAPES.map(shape => (
          <button
            key={shape.id}
            type="button"
            title={shape.label}
            aria-label={shape.label}
            onClick={() => onChange(shape.id)}
            className={`p-2 rounded-xl border-2 transition-all ${
              value === shape.id
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <LogoShapeIcon shape={shape.id} selected={value === shape.id} />
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
    </div>
  )
}
