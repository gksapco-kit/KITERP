/**
 * Ensures the full KITERP dev stack is running in Docker:
 * postgres, redis, backend, admin (3000), vendor (3001), storefront (3002).
 *
 * Set SKIP_ENSURE_BACKEND=1 to skip entirely.
 * Set KITERP_DOCKER_FRONTENDS=0 to start only postgres + redis + backend.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HEALTH_URL = process.env.KITERP_BACKEND_HEALTH_URL || 'http://127.0.0.1:8000/health'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TIMEOUT_MS = Number(process.env.KITERP_BACKEND_WAIT_MS || 120_000)
const POLL_MS = 1500
const LOCK_FILE = path.join(os.tmpdir(), 'kiterp-ensure-dev-stack.lock')

const CORE_SERVICES = ['postgres', 'redis', 'backend']
const FRONTEND_SERVICES = ['frontend', 'vendor-web', 'storefront-web']

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function dockerServices() {
  if (process.env.KITERP_DOCKER_FRONTENDS === '0') return CORE_SERVICES
  return [...CORE_SERVICES, ...FRONTEND_SERVICES]
}

/** Warn when host ports are taken by local Vite (npm run dev) — Docker frontends cannot bind. */
function checkPortConflicts() {
  if (process.platform !== 'win32') return
  const ports = [3000, 3001, 3002]
  const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true })
  if (result.status !== 0 || !result.stdout) return
  const blocked = ports.filter((port) => {
    const re = new RegExp(`:${port}\\s`)
    return result.stdout.split('\n').some((line) => {
      if (!re.test(line) || !line.includes('LISTENING')) return false
      // Docker publishes 127.0.0.1:3001 — ignore if only that binding exists for docker-owned PIDs
      return true
    })
  })
  if (blocked.length === 0) return
  console.warn('\n[kiterp] Warning: host port(s) already in use:', blocked.join(', '))
  console.warn('  Local `npm run dev` and Docker frontends cannot run on the same ports.')
  console.warn('  Stop local Vite terminals first, then run: npm run dev:docker')
  console.warn('  Or use local-only mode: npm run dev (backend in Docker is fine)\n')
}

async function pingHealth() {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 4000)
  try {
    const response = await fetch(HEALTH_URL, { signal: ac.signal, cache: 'no-store' })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function dockerComposeUp(services) {
  const label = services.join(', ')
  console.log(`\n[kiterp] Starting Docker dev stack: ${label}…\n`)
  const result = spawnSync('docker', ['compose', 'up', '-d', ...services], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.error('\n[kiterp] Failed to start Docker dev stack.')
    console.error('  • Is Docker Desktop running?')
    console.error(`  • Try: docker compose up -d ${services.join(' ')}`)
    console.error(`  • Backend health: ${HEALTH_URL}\n`)
    process.exit(result.status ?? 1)
  }
}

function dockerPsStoppedFrontends() {
  const result = spawnSync(
    'docker',
    ['compose', 'ps', '-a', '--format', 'json'],
    { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' },
  )
  if (result.status !== 0 || !result.stdout?.trim()) return FRONTEND_SERVICES

  const stopped = []
  for (const line of result.stdout.trim().split('\n')) {
    try {
      const row = JSON.parse(line)
      const service = row.Service
      const state = (row.State || row.Status || '').toLowerCase()
      if (FRONTEND_SERVICES.includes(service) && (state.includes('exited') || state.includes('dead'))) {
        stopped.push(service)
      }
    } catch {
      /* ignore malformed line */
    }
  }
  return stopped
}

async function waitForBackend(label = '') {
  const deadline = Date.now() + TIMEOUT_MS
  process.stdout.write(`[kiterp${label}] Waiting for backend`)
  while (Date.now() < deadline) {
    if (await pingHealth()) {
      console.log(`\n[kiterp${label}] Backend is ready.\n`)
      return
    }
    process.stdout.write('.')
    await sleep(POLL_MS)
  }

  console.error(`\n[kiterp${label}] Backend did not become ready in time.`)
  console.error('  Check: docker compose logs backend --tail 50')
  console.error(`  Health URL: ${HEALTH_URL}\n`)
  process.exit(1)
}

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx')
    fs.writeFileSync(fd, String(process.pid))
    fs.closeSync(fd)
    return true
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') return false
    throw err
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE)
  } catch {
    /* ignore */
  }
}

async function waitForPeerLock() {
  const deadline = Date.now() + TIMEOUT_MS
  process.stdout.write('[kiterp] Another process is starting the dev stack')
  while (Date.now() < deadline) {
    if (await pingHealth()) {
      console.log('\n[kiterp] Dev stack OK (started by another process)')
      return
    }
    if (!fs.existsSync(LOCK_FILE)) break
    process.stdout.write('.')
    await sleep(POLL_MS)
  }
  await waitForBackend(' (peer wait)')
}

async function main() {
  if (process.env.SKIP_ENSURE_BACKEND === '1') {
    console.log('[kiterp] SKIP_ENSURE_BACKEND=1 — skipping dev stack check')
    return
  }

  const includeFrontends = process.env.KITERP_DOCKER_FRONTENDS !== '0'
  const backendUp = await pingHealth()
  const stoppedFrontends = includeFrontends ? dockerPsStoppedFrontends() : []

  if (backendUp && stoppedFrontends.length === 0) {
    console.log('[kiterp] Dev stack OK:', HEALTH_URL)
    if (includeFrontends) {
      console.log('[kiterp] Frontends: http://127.0.0.1:3000  http://127.0.0.1:3001  http://127.0.0.1:3002')
    }
    return
  }

  const ownsLock = acquireLock()
  if (!ownsLock) {
    await waitForPeerLock()
    return
  }

  try {
    checkPortConflicts()
    const services = backendUp && stoppedFrontends.length
      ? stoppedFrontends
      : dockerServices()
    dockerComposeUp(services)
    if (!backendUp) await waitForBackend()
    if (includeFrontends) {
      console.log('[kiterp] Frontends:')
      console.log('  Admin:    http://127.0.0.1:3000')
      console.log('  Vendor:   http://127.0.0.1:3001')
      console.log('  Store:    http://127.0.0.1:3002')
    }
  } finally {
    releaseLock()
  }
}

main()
