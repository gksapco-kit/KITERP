/** Re-export wellness copy helpers from storefront (shared logic). */
export {
  sanitizeWellnessCategoryTitle,
  sanitizeWellnessCtaLabel,
  sanitizeWellnessBodyCopy,
  sanitizeWellnessTemplateCopy,
  isTemplateMealFeaturesBlock,
  productFocusedFeatureContent,
  isTemplateTimelineBlock,
  genericTimelineContent,
  resolveWellnessFeatureImage,
  resolveWellnessCategoryImage,
  WELLNESS_FEATURE_FALLBACK_IMAGES,
} from '@storefront/lib/wellnessTemplateCopy'
