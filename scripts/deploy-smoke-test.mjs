/**
 * End-to-end deploy smoke test:
 * - SPA is served
 * - two clients sync via authenticated WebSocket
 * - content survives restart (--full Docker, or --local Go binary)
 *
 * Usage:
 *   cd scripts && npm ci
 *   node deploy-smoke-test.mjs --full    # Docker image + volume restart
 *   node deploy-smoke-test.mjs --local   # Go binary + process restart
 *
 * Or against an already-running server:
 *   node deploy-smoke-test.mjs --base http://localhost:8080
 */
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const require = createRequire(import.meta.url)
const WebSocket = require('ws')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const full = args.includes('--full')
const local = args.includes('--local')
const baseIdx = args.indexOf('--base')
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || process.env.SMOKE_BASE || 'http://localhost:8080'
const MARKER = process.env.SMOKE_MARKER || 'deploy-smoke-persistence-ok'
const CONTAINER = process.env.SMOKE_CONTAINER || 'collab-smoke'
const TIMEOUT_MS = 20_000

function parseCookie(setCookie) {
  if (!setCookie) return ''
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie
  return String(first).split(';')[0]
}

async function api(pathname, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${text}`)
  }
  const setCookie = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : res.headers.get('set-cookie')
  return { json, cookie: parseCookie(setCookie) || cookie || '' }
}

function waitForSync(provider) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sync timeout')), TIMEOUT_MS)
    if (provider.synced) {
      clearTimeout(timer)
      resolve()
      return
    }
    provider.on('sync', (synced) => {
      if (synced) {
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

function waitForText(ytext, expected, label) {
  return new Promise((resolve, reject) => {
    if (ytext.toString() === expected) {
      resolve()
      return
    }
    const timer = setTimeout(
      () => reject(new Error(`${label}: expected "${expected}", got "${ytext.toString()}"`)),
      TIMEOUT_MS,
    )
    const observer = () => {
      if (ytext.toString() === expected) {
        clearTimeout(timer)
        ytext.unobserve(observer)
        resolve()
      }
    }
    ytext.observe(observer)
  })
}

function authedWS(cookie) {
  return class AuthedWebSocket extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { Cookie: cookie } })
    }
  }
}

function wsBase() {
  const u = new URL(BASE)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${u.origin}/yjs`
}

async function openClient(docId, cookie) {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText('content')
  const provider = new WebsocketProvider(wsBase(), docId, ydoc, {
    WebSocketPolyfill: authedWS(cookie),
    connect: true,
    maxBackoffTime: 5_000,
  })
  await waitForSync(provider)
  return { ydoc, ytext, provider }
}

function destroyClient(client) {
  client.provider.destroy()
  client.ydoc.destroy()
}

async function waitHealthy(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`server not healthy at ${BASE}`)
}

async function assertSpa() {
  const spa = await fetch(`${BASE}/`)
  if (!spa.ok) throw new Error(`SPA / → ${spa.status}`)
  const html = await spa.text()
  if (!html.includes('id="root"')) {
    throw new Error('SPA index.html missing root mount')
  }
  const docsRoute = await fetch(`${BASE}/docs`)
  if (!docsRoute.ok) throw new Error(`SPA /docs → ${docsRoute.status}`)
  console.log('SPA_OK')
}

async function phaseWrite(cookie) {
  const { json: doc } = await api('/api/documents', {
    method: 'POST',
    body: { title: 'Deploy smoke test' },
    cookie,
  })

  const a = await openClient(doc.id, cookie)
  const b = await openClient(doc.id, cookie)

  a.ytext.insert(0, MARKER)
  await waitForText(b.ytext, MARKER, 'B after A insert')

  // Give persistence a moment to flush the update to SQLite.
  await new Promise((r) => setTimeout(r, 500))

  destroyClient(a)
  destroyClient(b)

  console.log('PHASE_WRITE_OK', doc.id)
  return doc.id
}

async function phaseVerify(cookie, docId) {
  const client = await openClient(docId, cookie)
  await waitForText(client.ytext, MARKER, 'restored after restart')
  destroyClient(client)
  console.log('PHASE_VERIFY_OK', docId)
}

function docker(...args) {
  const result = spawnSync('docker', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function killProcess(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { encoding: 'utf8' })
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

async function runSessionFlow(restart) {
  await assertSpa()

  const { cookie } = await api('/api/session', {
    method: 'POST',
    body: { username: 'smoke-user' },
  })
  if (!cookie) throw new Error('missing session cookie')

  const docId = await phaseWrite(cookie)
  await restart()
  await waitHealthy()
  await phaseVerify(cookie, docId)
}

async function runFull() {
  console.log('Building production image...')
  docker('build', '-t', 'collab-editor:smoke', '.')

  spawnSync('docker', ['rm', '-f', CONTAINER], { encoding: 'utf8' })
  spawnSync('docker', ['volume', 'rm', '-f', 'collab_smoke_data'], { encoding: 'utf8' })

  console.log('Starting container...')
  docker(
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-p',
    '8080:8080',
    '-e',
    'SESSION_SECRET=smoke-test-session-secret-32b',
    '-e',
    'COOKIE_SECURE=false',
    '-v',
    'collab_smoke_data:/data',
    'collab-editor:smoke',
  )

  try {
    await waitHealthy()
    await runSessionFlow(async () => {
      console.log('Restarting container (persistence check)...')
      docker('restart', CONTAINER)
    })
    console.log('PASS: deploy smoke test (SPA + sync + restart restore)')
  } finally {
    spawnSync('docker', ['rm', '-f', CONTAINER], { encoding: 'utf8' })
    spawnSync('docker', ['volume', 'rm', '-f', 'collab_smoke_data'], { encoding: 'utf8' })
  }
}

async function runLocal() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-smoke-'))
  const staticDir = path.join(ROOT, 'frontend', 'dist')
  const dbPath = path.join(dataDir, 'collab.db')
  const serverBin = path.join(dataDir, process.platform === 'win32' ? 'server.exe' : 'server')

  if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    console.log('Building frontend...')
    const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
      cwd: path.join(ROOT, 'frontend'),
      encoding: 'utf8',
      shell: true,
    })
    if (build.status !== 0) {
      throw new Error(`frontend build failed:\n${build.stderr || build.stdout}`)
    }
  }

  console.log('Building Go server...')
  const gobuild = spawnSync('go', ['build', '-o', serverBin, './cmd/server'], {
    cwd: path.join(ROOT, 'backend'),
    encoding: 'utf8',
  })
  if (gobuild.status !== 0) {
    throw new Error(`go build failed:\n${gobuild.stderr || gobuild.stdout}`)
  }

  const env = {
    ...process.env,
    PORT: '8080',
    DATABASE_PATH: dbPath,
    STATIC_DIR: staticDir,
    SESSION_SECRET: 'smoke-test-session-secret-32b',
    COOKIE_SECURE: 'false',
  }

  let child = null
  const startServer = () => {
    child = spawn(serverBin, [], {
      env,
      cwd: dataDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })
    child.stdout.on('data', () => {})
    child.stderr.on('data', () => {})
  }

  try {
    startServer()
    await waitHealthy()
    await runSessionFlow(async () => {
      console.log('Restarting server process (persistence check)...')
      killProcess(child)
      child = null
      await new Promise((r) => setTimeout(r, 500))
      startServer()
    })
    console.log('PASS: local deploy smoke test (SPA + sync + restart restore)')
  } finally {
    killProcess(child)
    try {
      fs.rmSync(dataDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
}

async function main() {
  if (full) {
    await runFull()
    return
  }
  if (local) {
    await runLocal()
    return
  }

  await waitHealthy()
  const existingDoc = process.env.SMOKE_DOC_ID
  const { cookie } = await api('/api/session', {
    method: 'POST',
    body: { username: process.env.SMOKE_USER || 'smoke-user' },
  })
  if (!cookie) throw new Error('missing session cookie')

  if (existingDoc) {
    await phaseVerify(cookie, existingDoc)
  } else {
    const id = await phaseWrite(cookie)
    console.log('Set SMOKE_DOC_ID=' + id + ' after restart to verify restore')
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message || err)
  process.exit(1)
})
