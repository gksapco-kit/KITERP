import Constants from "expo-constants";
import { apiClient, resolveVendorBySlug } from "../api/client";

export interface VendorBranding {
  vendorSlug: string | null;
  isBrandedApp: boolean;
  name: string;
  primaryColor: string;
  logoUrl?: string;
  themeConfig: Record<string, string>;
}

const extra = Constants.expoConfig?.extra ?? {};

const VENDOR_SLUG: string | null = extra.vendorSlug ?? null;
const IS_BRANDED_APP: boolean = extra.isBrandedApp ?? false;

let _cachedBranding: VendorBranding | null = null;

export function getVendorSlug(): string | null {
  return VENDOR_SLUG;
}

export function isBrandedApp(): boolean {
  return IS_BRANDED_APP;
}

export async function loadVendorBranding(): Promise<VendorBranding> {
  if (_cachedBranding) return _cachedBranding;

  if (!VENDOR_SLUG) {
    _cachedBranding = {
      vendorSlug: null,
      isBrandedApp: false,
      name: "KITERP",
      primaryColor: "#2563eb",
      themeConfig: {},
    };
    return _cachedBranding;
  }

  try {
    const vendor = await resolveVendorBySlug(VENDOR_SLUG);
    _cachedBranding = {
      vendorSlug: VENDOR_SLUG,
      isBrandedApp: true,
      name: vendor.display_name || vendor.business_name,
      primaryColor: vendor.theme_config?.primary_color || "#2563eb",
      logoUrl: vendor.logo_url || undefined,
      themeConfig: vendor.theme_config || {},
    };
  } catch {
    _cachedBranding = {
      vendorSlug: VENDOR_SLUG,
      isBrandedApp: true,
      name: VENDOR_SLUG,
      primaryColor: "#2563eb",
      themeConfig: {},
    };
  }

  return _cachedBranding;
}

export function clearBrandingCache(): void {
  _cachedBranding = null;
}
