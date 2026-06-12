import { useTheme } from '@/contexts/ThemeContext'
import { linkOnLight, textOnSolid } from '@/lib/themeColors'

/** Brand colors for customer auth pages — uses business-front theme_config via ThemeProvider. */
export function useAuthStoreTheme() {
  const theme = useTheme()
  const { primary, secondary, accent, background } = theme.colors
  return {
    primary,
    secondary,
    accent,
    background,
    linkColor: linkOnLight(primary, secondary),
    btnText: textOnSolid(primary),
    panelGradient: `linear-gradient(145deg, ${secondary} 0%, ${primary} 50%, ${secondary}e8 100%)`,
    fontFamily: theme.font_body || theme.font,
  }
}
