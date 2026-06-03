/**
 * Makes http://localhost:3001 and :3002 work on Windows + Docker Desktop.
 * Docker publishes 127.0.0.1:13001/13002; this bridge listens on :3001/:3002 (IPv4+IPv6).
 */
import http from 'node:http'
import httpProxy from 'http-proxy'

const BRIDGES = [
  { listen: 3001, target: 'http://127.0.0.1:13001', label: 'vendor-web' },
  { listen: 3002, target: 'http://127.0.0.1:13002', label: 'storefront-web' },
]

for (const { listen, target, label } of BRIDGES) {
  const proxy = httpProxy.createProxyServer({
    target,
    ws: true,
    changeOrigin: true,
  })

  proxy.on('error', (err, _req, res) => {
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(
        `localhost bridge error (${label}): ${err.message}\n\n`
        + `Is Docker running? Try: docker compose up -d vendor-web storefront-web\n`,
      )
    }
  })

  const server = http.createServer((req, res) => {
    proxy.web(req, res, { target })
  })

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head, { target })
  })

  server.listen(listen, () => {
    console.log(`[localhost-bridge] http://localhost:${listen} -> ${target} (${label})`)
  })
}

console.log('[localhost-bridge] Ready — use http://localhost:3001 and http://localhost:3002')
