const path = require("path");
const fs = require("fs");

const VENDOR_SLUG = process.env.VENDOR_SLUG || null;

function loadVendorConfig(slug) {
  const configPath = path.resolve(__dirname, "vendors", slug, "config.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  return null;
}

const defaults = {
  name: "KITERP",
  slug: "kiterp-mobile",
  scheme: "kiterp",
  bundleId: "com.kiterp.mobile",
  package: "com.kiterp.mobile",
  primaryColor: "#2563eb",
  icon: "./assets/icon.png",
  adaptiveIconForeground: "./assets/adaptive-icon.png",
};

const vendorCfg = VENDOR_SLUG ? loadVendorConfig(VENDOR_SLUG) : null;

const appName = vendorCfg?.name || defaults.name;
const appSlug = vendorCfg?.slug || defaults.slug;
const scheme = vendorCfg?.scheme || defaults.scheme;
const bundleId = vendorCfg?.bundleId || defaults.bundleId;
const androidPackage = vendorCfg?.package || defaults.package;
const primaryColor = vendorCfg?.primaryColor || defaults.primaryColor;

const vendorIconPath = VENDOR_SLUG
  ? `./vendors/${VENDOR_SLUG}/icon.png`
  : null;
const vendorAdaptiveIconPath = VENDOR_SLUG
  ? `./vendors/${VENDOR_SLUG}/adaptive-icon.png`
  : null;

const icon =
  vendorIconPath && fs.existsSync(path.resolve(__dirname, vendorIconPath))
    ? vendorIconPath
    : defaults.icon;

const adaptiveIconForeground =
  vendorAdaptiveIconPath &&
  fs.existsSync(path.resolve(__dirname, vendorAdaptiveIconPath))
    ? vendorAdaptiveIconPath
    : defaults.adaptiveIconForeground;

module.exports = () => ({
  expo: {
    name: appName,
    slug: appSlug,
    version: "1.0.0",
    orientation: "portrait",
    icon,
    scheme,
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: primaryColor,
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: adaptiveIconForeground,
        backgroundColor: primaryColor,
      },
      package: androidPackage,
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: icon,
    },
    plugins: ["expo-router", "expo-secure-store"],
    updates: {
      url: "https://u.expo.dev/9b598a58-a149-47f9-b5c0-574016f72caa",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    extra: {
      vendorSlug: VENDOR_SLUG,
      isBrandedApp: !!VENDOR_SLUG,
      eas: {
        projectId:
          process.env.EAS_PROJECT_ID || "9b598a58-a149-47f9-b5c0-574016f72caa",
      },
    },
  },
});
