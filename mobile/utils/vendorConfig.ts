import Constants from "expo-constants";
import { resolveVendorBySlug, setVendorId, setVendorSlug } from "../api/client";

export interface VendorBranding {
  vendorSlug: string | null;
  vendorId: string | null;
  isBrandedApp: boolean;
  name: string;
  primaryColor: string;
  logoUrl?: string;
  themeConfig: Record<string, string>;
}

const extra = Constants.expoConfig?.extra ?? {};

const VENDOR_SLUG: string | null = extra.vendorSlug ?? null;
const IS_BRANDED_APP: boolean = extra.isBrandedApp ?? false;
const BUILD_PRIMARY: string = extra.primaryColor || "#2563eb";
const BUILD_NAME: string = extra.appName || "KITERP";

let _cachedBranding: VendorBranding | null = null;

/** Branded APK / store slug for SR Marketing and Services only. */
export const SR_MARKETING_SLUG = "sr-marketing-and-services";

export function getVendorSlug(): string | null {
  return VENDOR_SLUG;
}

export function isBrandedApp(): boolean {
  return IS_BRANDED_APP;
}

/** True only for the SR Marketing branded app / store — never other vendors. */
export function isSrMarketingStore(slug?: string | null): boolean {
  const candidates = [slug, VENDOR_SLUG, _cachedBranding?.vendorSlug]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());
  return candidates.some((s) => s === SR_MARKETING_SLUG);
}

export async function loadVendorBranding(): Promise<VendorBranding> {
  if (_cachedBranding) return _cachedBranding;

  if (!VENDOR_SLUG) {
    _cachedBranding = {
      vendorSlug: null,
      vendorId: null,
      isBrandedApp: false,
      name: "KITERP",
      primaryColor: "#2563eb",
      themeConfig: {},
    };
    return _cachedBranding;
  }

  // Always scope API calls to this vendor for branded APKs
  setVendorSlug(VENDOR_SLUG);

  try {
    const vendor = await resolveVendorBySlug(VENDOR_SLUG);
    setVendorId(vendor.id);
    setVendorSlug(vendor.slug || VENDOR_SLUG);
    _cachedBranding = {
      vendorSlug: vendor.slug || VENDOR_SLUG,
      vendorId: vendor.id,
      isBrandedApp: true,
      name: vendor.display_name || vendor.business_name || BUILD_NAME,
      primaryColor: vendor.theme_config?.primary_color || BUILD_PRIMARY,
      logoUrl: vendor.logo_url || undefined,
      themeConfig: vendor.theme_config || {},
    };
  } catch {
    _cachedBranding = {
      vendorSlug: VENDOR_SLUG,
      vendorId: null,
      isBrandedApp: true,
      name: BUILD_NAME,
      primaryColor: BUILD_PRIMARY,
      themeConfig: {},
    };
  }

  return _cachedBranding;
}

export function clearBrandingCache(): void {
  _cachedBranding = null;
}
