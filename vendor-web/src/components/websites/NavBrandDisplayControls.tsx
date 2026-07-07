import {
  NAV_BRAND_LAYOUT_OPTIONS,
  NAV_BRAND_NAME_SIZE_OPTIONS,
  NAV_LOGO_FIT_OPTIONS,
  NAV_LOGO_SHAPE_OPTIONS,
  NAV_LOGO_SIZE_OPTIONS,
  navBrandDisplayPreview,
  readNavBrandGap,
  readNavBrandLayout,
  readNavBrandNameSize,
  readNavLogoFit,
  readNavLogoShape,
  readNavLogoSize,
} from '@storefront/lib/navBrandStyle'
import type { BlockProps } from '@/types/websites'
import {
  PanelChip,
  PanelChipWrap,
  PanelFieldLabel,
  PanelSliderRow,
} from '@/components/websites/BuilderPanelFields'

export function NavBrandDisplayControls({
  props: p,
  onUpdate,
}: {
  props: Record<string, unknown>
  onUpdate: (props: Partial<BlockProps>) => void
}) {
  const layout = readNavBrandLayout(p)
  const logoSize = readNavLogoSize(p)
  const logoShape = readNavLogoShape(p)
  const logoFit = readNavLogoFit(p)
  const nameSize = readNavBrandNameSize(p)
  const gap = readNavBrandGap(p)

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Display
      </p>
      <p className="text-[10px] text-muted-foreground -mt-1">{navBrandDisplayPreview(p)}</p>

      <div className="space-y-1">
        <PanelFieldLabel>Layout</PanelFieldLabel>
        <PanelChipWrap>
          {NAV_BRAND_LAYOUT_OPTIONS.map(opt => (
            <PanelChip
              key={opt.value}
              active={layout === opt.value}
              onClick={() => onUpdate({ brand_layout: opt.value })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
      </div>

      <div className="space-y-1">
        <PanelFieldLabel>Logo size</PanelFieldLabel>
        <PanelChipWrap>
          {NAV_LOGO_SIZE_OPTIONS.map(opt => (
            <PanelChip
              key={opt.value}
              active={logoSize === opt.value}
              onClick={() => onUpdate({ logo_size: opt.value })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
      </div>

      <div className="space-y-1">
        <PanelFieldLabel>Logo shape</PanelFieldLabel>
        <PanelChipWrap>
          {NAV_LOGO_SHAPE_OPTIONS.map(opt => (
            <PanelChip
              key={opt.value}
              active={logoShape === opt.value}
              onClick={() => onUpdate({ logo_shape: opt.value })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
      </div>

      {logoShape !== 'original' && (
        <div className="space-y-1">
          <PanelFieldLabel>Logo crop</PanelFieldLabel>
          <PanelChipWrap>
            {NAV_LOGO_FIT_OPTIONS.map(opt => (
              <PanelChip
                key={opt.value}
                active={logoFit === opt.value}
                onClick={() => onUpdate({ logo_fit: opt.value })}
              >
                {opt.label}
              </PanelChip>
            ))}
          </PanelChipWrap>
        </div>
      )}

      <PanelSliderRow
        label="Space between logo & name"
        value={gap}
        min={0}
        max={32}
        step={2}
        unit="px"
        onCommit={n => onUpdate({ brand_gap: n })}
      />

      <div className="space-y-1">
        <PanelFieldLabel>Brand name size</PanelFieldLabel>
        <PanelChipWrap>
          {NAV_BRAND_NAME_SIZE_OPTIONS.map(opt => (
            <PanelChip
              key={opt.value}
              active={nameSize === opt.value}
              onClick={() => onUpdate({ brand_name_size: opt.value })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
      </div>
    </div>
  )
}
