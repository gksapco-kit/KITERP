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

const vendorSrc = path.resolve(__dirname, './src')

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

/** Resolve storefront `@/` imports when bundling preview components from storefront-web. */
function storefrontPreviewImports() {
  return {
    name: 'storefront-preview-imports',
    enforce: 'pre',
    resolveId(source: string, importer?: string) {
      if (!source.startsWith('@/')) return null
      if (!isStorefrontModule(importer)) return null
      return resolveAtImport(source, importer)
    },
  }
}

// Polling is for Docker bind-mounts / network FS. On Windows + OneDrive it makes dev painfully slow.
const useWatchPolling = process.env.VITE_WATCH_POLLING === '1'

export default defineConfig({
  plugins: [storefrontPreviewImports(), react()],
  base: publicBasePath,
  resolve: {
    alias: [
      {
        find: /^@\/(.+)$/,
        replacement: '$1',
        customResolver(source, importer) {
          return resolveAtImport(`@/${source}`, importer)
        },
      },
      { find: '@storefront', replacement: storefrontSrc },
      { find: '@kiterp/home-sections', replacement: path.join(storefrontSrc, 'home-sections') },
      {
        find: '@kiterp/storefront-theme-colors',
        replacement: path.join(storefrontSrc, 'lib/themeColors.ts'),
      },
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
      clientFiles: ['./index.html', './src/main.tsx'],
    },
    ...(useWatchPolling ? { watch: { usePolling: true, interval: 1000 } } : {}),
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
