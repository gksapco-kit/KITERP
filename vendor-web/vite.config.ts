import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// In Docker the BACKEND_URL env var points to the internal service name.
// When running locally (npm run dev) it falls back to localhost:8000.
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
const publicBasePath = process.env.VITE_PUBLIC_BASE_PATH?.trim() || '/'
const dockerStorefrontSrc = '/storefront-web/src'
const storefrontSrc = fs.existsSync(dockerStorefrontSrc)
  ? dockerStorefrontSrc
  : path.resolve(__dirname, '../storefront-web/src')
const monorepoRoot = path.resolve(__dirname, '..')

const vendorSrc = path.resolve(__dirname, './src')
/** Trailing slash required so `@storefront/lib/foo` resolves (Vite alias subpath rule). */
const storefrontSrcPosix = `${storefrontSrc.replace(/\\/g, '/')}/`

function isStorefrontModule(importer?: string): boolean {
  if (!importer) return false
  const norm = importer.replace(/\\/g, '/')
  return norm.includes('storefront-web')
}

function isExistingFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

/** Resolve a module path to an actual file (handles `foo/index.ts` when import is `@/foo`). */
function resolveModuleFile(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.mts`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
  ]
  for (const candidate of candidates) {
    if (isExistingFile(candidate)) return candidate
  }
  return null
}

function resolveAtImport(source: string, importer?: string): string | undefined {
  const rel = source.startsWith('@/') ? source.slice(2) : source
  const baseDir = isStorefrontModule(importer) ? storefrontSrc : vendorSrc
  return resolveModuleFile(path.join(baseDir, rel)) ?? undefined
}

/** Resolve explicit `@storefront/…` imports from vendor-web to files under storefront-web/src. */
function resolveStorefrontImport(source: string): string | undefined {
  if (!source.startsWith('@storefront/')) return undefined
  const rel = source.slice('@storefront/'.length)
  return resolveModuleFile(path.join(storefrontSrc, rel)) ?? undefined
}

/** Resolve storefront `@/` and `@storefront/` imports to real files (not virtual `@storefront/` URLs). */
function storefrontPreviewImports() {
  return {
    name: 'storefront-preview-imports',
    enforce: 'pre',
    resolveId(source: string, importer?: string) {
      const storefrontFile = resolveStorefrontImport(source)
      if (storefrontFile) return storefrontFile
      if (!source.startsWith('@/')) return null
      if (!isStorefrontModule(importer)) return null
      return resolveAtImport(source, importer) ?? null
    },
  }
}

const vendorImporter = path.resolve(__dirname, 'src/main.tsx')

/**
 * Storefront sources are mounted outside vendor-web in Docker (`/storefront-web`).
 * Node resolution from those files does not reach `/app/node_modules`, so bare imports
 * must be resolved from vendor-web's tree. Use Vite's resolver (not raw file paths) so
 * optimizeDeps pre-bundling applies — raw ESM entries break deps like use-sync-external-store.
 */
function resolveStorefrontBareImports() {
  return {
    name: 'resolve-storefront-bare-imports',
    enforce: 'pre',
    async resolveId(source: string, importer?: string) {
      if (!importer || !isStorefrontModule(importer)) return null
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null
      if (source.startsWith('@/') || source.startsWith('@storefront/')) return null
      const resolved = await this.resolve(source, vendorImporter, { skipSelf: true })
      return resolved?.id ?? null
    },
  }
}

// Polling is for Docker bind-mounts / network FS. On Windows + OneDrive it makes dev painfully slow.
const useWatchPolling = process.env.VITE_WATCH_POLLING === '1'

export default defineConfig({
  plugins: [storefrontPreviewImports(), resolveStorefrontBareImports(), react()],
  base: publicBasePath,
  optimizeDeps: {
    include: [
      'zustand',
      'zustand/middleware',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-avatar',
      '@radix-ui/react-switch',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      'use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim',
    ],
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.+)$/,
        replacement: '$1',
        customResolver(source, importer) {
          return resolveAtImport(`@/${source}`, importer)
        },
      },
      { find: '@storefront', replacement: storefrontSrcPosix },
    ],
  },
  server: {
    port: 3001,
    strictPort: true,
    /** `true` avoids localhost hanging on some Windows setups; use http://127.0.0.1:3001 if needed. */
    host: true,
    /** Allow Docker / reverse-proxy hostnames (Vite 5+ host check). */
    allowedHosts: true,
    /** Align HMR client port with host port map (e.g. Docker 3001:3001). */
    hmr: { clientPort: 3001 },
    /** Pre-transform entry files so first browser open is not a 30s+ hang on OneDrive. */
    warmup: {
      clientFiles: [
        './index.html',
        './src/main.tsx',
        '../storefront-web/src/components/builder/BlockRenderer.tsx',
        '../storefront-web/src/components/builder/blocks/FooterBlock.tsx',
        '../storefront-web/src/components/builder/blocks/NavBlock.tsx',
        '../storefront-web/src/components/builder/blocks/ProductGridBlock.tsx',
      ],
    },
    watch: {
      ...(useWatchPolling ? { usePolling: true, interval: 1000 } : {}),
      // Avoid ENODATA overlay when the editor saves while Vite is mid-read (Windows / bind mounts).
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    },
    /** storefront-web lives outside vendor-web root — required for @fs lazy chunks in preview. */
    fs: {
      allow: [monorepoRoot, storefrontSrc],
    },
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/uploads': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      // FastAPI /health (not under /api/v1) — used by login connectivity check
      '/health': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
})
