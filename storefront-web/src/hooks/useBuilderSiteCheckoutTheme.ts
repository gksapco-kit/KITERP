import { useMemo, type CSSProperties } from 'react'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { buildCheckoutThemeFromSiteStyle } from '@/checkout/buildCheckoutThemeFromSiteStyle'
import type { StyleConfig } from '@/blocks/registry'

/** Inline CSS vars for `.checkout-root` from the builder / draft preview style_config. */
export function useBuilderSiteCheckoutTheme(): CSSProperties | undefined {
  const { builderSite } = useBuilderSite()
  return useMemo(() => {
    const style = builderSite?.style_config as (Partial<StyleConfig> & Record<string, unknown>) | undefined
    return style ? buildCheckoutThemeFromSiteStyle(style) : undefined
  }, [builderSite?.style_config])
}
