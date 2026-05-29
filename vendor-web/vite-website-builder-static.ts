import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const EMBED_PREFIX = '/website-builder-app'
const EMBED_ROOT = path.resolve(__dirname, 'public/website-builder-app')
const EMBED_INDEX = path.join(EMBED_ROOT, 'index.html')

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

function safeEmbedFilePath(pathname: string): string | null {
  if (!pathname.startsWith(EMBED_PREFIX)) return null
  const relative = pathname.slice(EMBED_PREFIX.length).replace(/^\//, '') || 'index.html'
  const filePath = path.normalize(path.join(EMBED_ROOT, relative))
  if (!filePath.startsWith(EMBED_ROOT)) return null
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
  return filePath
}

function isEmbedAssetPath(pathname: string): boolean {
  if (!pathname.startsWith(EMBED_PREFIX)) return false
  const rest = pathname.slice(EMBED_PREFIX.length)
  if (!rest || rest === '/') return false
  return /\.[a-zA-Z0-9]+$/.test(rest.split('/').pop() ?? '')
}

function sendFile(
  filePath: string,
  res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
): void {
  const ext = path.extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream')
  res.end(fs.readFileSync(filePath))
}

/**
 * Serve `/website-builder-app/*` from `public/website-builder-app` directly.
 * Without this, Vite's SPA fallback returns vendor `index.html` for embed `.js` files → blank iframe.
 */
export function websiteBuilderStaticPlugin(): Plugin {
  const middleware = (
    req: { url?: string },
    res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
    next: () => void,
  ) => {
    const raw = req.url ?? ''
    const pathname = raw.split('?')[0] ?? ''

    if (!pathname.startsWith(EMBED_PREFIX)) {
      next()
      return
    }

    const filePath = safeEmbedFilePath(pathname)
    if (filePath) {
      sendFile(filePath, res)
      return
    }

    if (isEmbedAssetPath(pathname)) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`Website builder asset not found: ${pathname}\nRun: npm run build:website-builder`)
      return
    }

    if (!fs.existsSync(EMBED_INDEX)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Website builder embed missing. Run: npm run build:website-builder')
      return
    }

    sendFile(EMBED_INDEX, res)
  }

  return {
    name: 'website-builder-static',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
