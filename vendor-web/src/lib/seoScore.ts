import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from '@/lib/seoLimits'
import type { WebsitePage, WebsiteSite } from '@/types/websites'

export type SeoCheckStatus = 'good' | 'warn' | 'bad' | 'na'

export interface SeoCheck {
  id: string
  label: string
  status: SeoCheckStatus
  message: string
  points: number
  maxPoints: number
}

export type SeoScoreLabel = 'excellent' | 'good' | 'needs-work' | 'poor' | 'hidden'

export interface SeoScoreResult {
  score: number
  maxScore: number
  checks: SeoCheck[]
  label: SeoScoreLabel
}

export interface PageSeoDraft {
  seoTitle: string
  seoDesc: string
  ogImage: string
  focusKeyword: string
  pageKeywords: string
  ogTitle: string
  ogDesc: string
  noindex: boolean
}

export interface SiteSeoDraft {
  siteTitle: string
  siteDesc: string
  siteKw: string
}

function scoreLabel(score: number): SeoScoreLabel {
  if (score >= 90) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 45) return 'needs-work'
  return 'poor'
}

function keywordInText(keyword: string, ...texts: string[]): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return false
  return texts.some(t => t.toLowerCase().includes(k))
}

function pushCheck(checks: SeoCheck[], check: SeoCheck): number {
  checks.push(check)
  return check.points
}

export function pageSeoDraftFromPage(page: WebsitePage): PageSeoDraft {
  return {
    seoTitle: page.seo_title || '',
    seoDesc: page.seo_description || '',
    ogImage: page.og_image_url || '',
    focusKeyword: page.focus_keyword || '',
    pageKeywords: page.seo_keywords || '',
    ogTitle: page.og_title || '',
    ogDesc: page.og_description || '',
    noindex: Boolean(page.noindex),
  }
}

export function computePageSeoScore(
  page: WebsitePage,
  site: WebsiteSite,
  draft: PageSeoDraft,
): SeoScoreResult {
  const checks: SeoCheck[] = []
  let score = 0
  const maxScore = 100

  const customTitle = draft.seoTitle.trim()
  const customDesc = draft.seoDesc.trim()
  const titleText = customTitle || page.title
  const siteDesc = (site as { seo_description?: string }).seo_description?.trim() || ''
  const descText = customDesc || siteDesc

  if (customTitle) {
    const len = customTitle.length
    let status: SeoCheckStatus = 'good'
    let pts = 15
    let message = 'Custom Google title is set.'
    if (len >= 50 && len <= SEO_TITLE_MAX) {
      pts = 20
      message = 'Title length is in the ideal 50–60 character range.'
    } else if (len < 30) {
      status = 'warn'
      pts = 12
      message = 'Title is quite short — aim for 50–60 characters.'
    } else if (len < 50) {
      status = 'warn'
      pts = 16
      message = `Title is ${len} characters — consider expanding toward 50–60.`
    } else {
      status = 'warn'
      pts = 14
      message = `Title is ${len} characters — Google may truncate it.`
    }
    score += pushCheck(checks, { id: 'title', label: 'Meta title', status, message, points: pts, maxPoints: 20 })
  } else {
    score += pushCheck(checks, {
      id: 'title',
      label: 'Meta title',
      status: 'warn',
      message: `No custom title — Google will use “${titleText}”.`,
      points: 8,
      maxPoints: 20,
    })
  }

  if (customDesc) {
    const len = customDesc.length
    let status: SeoCheckStatus = 'good'
    let pts = 15
    let message = 'Custom meta description is set.'
    if (len >= 140 && len <= SEO_DESCRIPTION_MAX) {
      pts = 20
      message = 'Description length is in the ideal 140–160 character range.'
    } else if (len < 80) {
      status = 'warn'
      pts = 10
      message = 'Description is short — aim for 140–160 characters.'
    } else if (len < 140) {
      status = 'warn'
      pts = 16
      message = `Description is ${len} characters — consider expanding toward 140–160.`
    } else {
      status = 'warn'
      pts = 14
      message = `Description is ${len} characters — Google may truncate it.`
    }
    score += pushCheck(checks, { id: 'description', label: 'Meta description', status, message, points: pts, maxPoints: 20 })
  } else {
    score += pushCheck(checks, {
      id: 'description',
      label: 'Meta description',
      status: 'bad',
      message: descText
        ? 'No page-specific description — only the site default will be used.'
        : 'Missing — add a 150–160 character summary for this page.',
      points: descText ? 6 : 0,
      maxPoints: 20,
    })
  }

  const focusKw = draft.focusKeyword.trim()
  if (focusKw) {
    const inCopy = keywordInText(focusKw, customTitle || page.title, customDesc)
    score += pushCheck(checks, {
      id: 'focus-keyword',
      label: 'Focus keyword',
      status: inCopy ? 'good' : 'warn',
      message: inCopy
        ? `“${focusKw}” appears in your title or description.`
        : `“${focusKw}” is set — try using it in the title or description.`,
      points: inCopy ? 15 : 10,
      maxPoints: 15,
    })
  } else {
    score += pushCheck(checks, {
      id: 'focus-keyword',
      label: 'Focus keyword',
      status: 'warn',
      message: 'Add the main keyword you want this page to rank for.',
      points: 0,
      maxPoints: 15,
    })
  }

  const ogImage = draft.ogImage.trim() || (site as { og_image_url?: string }).og_image_url?.trim() || ''
  if (draft.ogImage.trim()) {
    score += pushCheck(checks, {
      id: 'share-image',
      label: 'Share image',
      status: 'good',
      message: 'This page has its own social preview image.',
      points: 15,
      maxPoints: 15,
    })
  } else if (ogImage) {
    score += pushCheck(checks, {
      id: 'share-image',
      label: 'Share image',
      status: 'warn',
      message: 'Using the site-wide share image — add a page-specific one if you can.',
      points: 10,
      maxPoints: 15,
    })
  } else {
    score += pushCheck(checks, {
      id: 'share-image',
      label: 'Share image',
      status: 'bad',
      message: 'No share image — links may look plain on WhatsApp and Facebook.',
      points: 0,
      maxPoints: 15,
    })
  }

  const hasKeywords = Boolean(draft.pageKeywords.trim() || (site as { seo_keywords?: string }).seo_keywords?.trim())
  score += pushCheck(checks, {
    id: 'keywords',
    label: 'Keywords',
    status: hasKeywords ? 'good' : 'warn',
    message: hasKeywords
      ? draft.pageKeywords.trim()
        ? 'Page-specific keywords are set.'
        : 'Using site-wide keywords.'
      : 'Add page or site keywords to clarify the topic.',
    points: hasKeywords ? 10 : 3,
    maxPoints: 10,
  })

  const hasSocialOverride = Boolean(draft.ogTitle.trim() || draft.ogDesc.trim())
  const hasGoogleSocialFallback = Boolean((customTitle || page.title) && (customDesc || siteDesc))
  if (hasSocialOverride) {
    score += pushCheck(checks, {
      id: 'social',
      label: 'Social share text',
      status: 'good',
      message: 'Custom share title or description is set for social apps.',
      points: 10,
      maxPoints: 10,
    })
  } else if (hasGoogleSocialFallback) {
    score += pushCheck(checks, {
      id: 'social',
      label: 'Social share text',
      status: 'good',
      message: 'Social apps will reuse your Google title and summary.',
      points: 8,
      maxPoints: 10,
    })
  } else {
    score += pushCheck(checks, {
      id: 'social',
      label: 'Social share text',
      status: 'warn',
      message: 'Add Google title/description or custom share text.',
      points: 2,
      maxPoints: 10,
    })
  }

  const slug = (page.slug || '').trim()
  const slugOk = page.is_homepage || (slug.length > 0 && !/^page(-\d+)?$/i.test(slug))
  score += pushCheck(checks, {
    id: 'slug',
    label: 'URL slug',
    status: slugOk ? 'good' : 'warn',
    message: page.is_homepage
      ? 'Homepage uses the root URL.'
      : slugOk
        ? `Clean URL: /${slug}`
        : 'Use a readable slug (e.g. /mango-pickle).',
    points: slugOk ? 10 : 5,
    maxPoints: 10,
  })

  const schemaType = (page.schema_type || 'auto').trim()
  const schemaConfigured = schemaType !== 'auto'
  checks.push({
    id: 'schema',
    label: 'Structured data',
    status: schemaConfigured ? 'good' : 'warn',
    message: schemaConfigured
      ? `Page schema: ${schemaType.replace(/_/g, ' ')}.`
      : 'Auto — schema is built from your page sections. Pick a type in Structured data for more control.',
    points: 0,
    maxPoints: 0,
  })

  if (draft.noindex) {
    checks.push({
      id: 'noindex',
      label: 'Search visibility',
      status: 'na',
      message: 'Hidden from Google (noindex) — score shows readiness if you enable indexing.',
      points: 0,
      maxPoints: 0,
    })
    return { score, maxScore, checks, label: 'hidden' }
  }

  return { score, maxScore, checks, label: scoreLabel(score) }
}

export function computeSiteSeoScore(site: WebsiteSite, draft: SiteSeoDraft): SeoScoreResult {
  const checks: SeoCheck[] = []
  let score = 0
  const maxScore = 100

  const title = draft.siteTitle.trim()
  const desc = draft.siteDesc.trim()
  const kw = draft.siteKw.trim()

  if (title) {
    const len = title.length
    const ideal = len >= 50 && len <= SEO_TITLE_MAX
    score += pushCheck(checks, {
      id: 'site-title',
      label: 'Default Google title',
      status: ideal ? 'good' : len < 50 ? 'warn' : 'warn',
      message: ideal
        ? 'Site default title length looks good.'
        : `Title is ${len} characters — aim for 50–60.`,
      points: ideal ? 25 : len >= 30 ? 18 : 12,
      maxPoints: 25,
    })
  } else {
    score += pushCheck(checks, {
      id: 'site-title',
      label: 'Default Google title',
      status: 'bad',
      message: site.name
        ? `Missing — pages may fall back to “${site.name}”.`
        : 'Missing — add a default title for the whole site.',
      points: site.name ? 8 : 0,
      maxPoints: 25,
    })
  }

  if (desc) {
    const len = desc.length
    const ideal = len >= 140 && len <= SEO_DESCRIPTION_MAX
    score += pushCheck(checks, {
      id: 'site-desc',
      label: 'Default Google summary',
      status: ideal ? 'good' : 'warn',
      message: ideal
        ? 'Site default summary length looks good.'
        : `Summary is ${len} characters — aim for 140–160.`,
      points: ideal ? 25 : len >= 80 ? 18 : 12,
      maxPoints: 25,
    })
  } else {
    score += pushCheck(checks, {
      id: 'site-desc',
      label: 'Default Google summary',
      status: 'bad',
      message: 'Missing — add a default description for pages without their own.',
      points: 0,
      maxPoints: 25,
    })
  }

  score += pushCheck(checks, {
    id: 'site-kw',
    label: 'Site keywords',
    status: kw ? 'good' : 'warn',
    message: kw ? 'Site-wide keywords are set.' : 'Optional but helpful — add comma-separated keywords.',
    points: kw ? 15 : 5,
    maxPoints: 15,
  })

  const favicon = (site as { favicon_url?: string }).favicon_url?.trim()
  score += pushCheck(checks, {
    id: 'favicon',
    label: 'Favicon',
    status: favicon ? 'good' : 'warn',
    message: favicon ? 'Favicon is set (Site settings in builder).' : 'Add a favicon in Builder → Site settings.',
    points: favicon ? 10 : 0,
    maxPoints: 10,
  })

  const logo = (site as { logo_url?: string }).logo_url?.trim()
  score += pushCheck(checks, {
    id: 'logo',
    label: 'Logo',
    status: logo ? 'good' : 'warn',
    message: logo ? 'Logo is set.' : 'Add a logo in Builder → Site settings for brand trust.',
    points: logo ? 10 : 0,
    maxPoints: 10,
  })

  const ogImage = (site as { og_image_url?: string }).og_image_url?.trim()
  score += pushCheck(checks, {
    id: 'site-og',
    label: 'Default share image',
    status: ogImage ? 'good' : 'warn',
    message: ogImage
      ? 'Site-wide social preview image is set.'
      : 'Add a default OG image in Builder → Site settings.',
    points: ogImage ? 15 : 5,
    maxPoints: 15,
  })

  return { score, maxScore, checks, label: scoreLabel(score) }
}

export function computePageSeoScoreFromSaved(page: WebsitePage, site: WebsiteSite): SeoScoreResult {
  return computePageSeoScore(page, site, pageSeoDraftFromPage(page))
}

export function computeSiteAveragePageScore(pages: WebsitePage[], site: WebsiteSite): number {
  const indexable = pages.filter(p => !p.noindex)
  if (!indexable.length) return 0
  const total = indexable.reduce((sum, p) => sum + computePageSeoScoreFromSaved(p, site).score, 0)
  return Math.round(total / indexable.length)
}

export function seoScoreColor(score: number, label?: SeoScoreLabel): string {
  if (label === 'hidden') return 'text-muted-foreground'
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 70) return 'text-primary'
  if (score >= 45) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

export function seoScoreRingColor(score: number, label?: SeoScoreLabel): string {
  if (label === 'hidden') return 'stroke-muted-foreground/40'
  if (score >= 90) return 'stroke-emerald-500'
  if (score >= 70) return 'stroke-primary'
  if (score >= 45) return 'stroke-amber-500'
  return 'stroke-destructive'
}

export function seoScoreLabelText(label: SeoScoreLabel): string {
  switch (label) {
    case 'excellent': return 'Excellent'
    case 'good': return 'Good'
    case 'needs-work': return 'Needs work'
    case 'poor': return 'Poor'
    case 'hidden': return 'Hidden from search'
  }
}
