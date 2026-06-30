/**
 * Automated spike test: two Yjs clients sync via ygo WebSocket server.
 * Run with: node scripts/spike-sync-test.mjs
 */
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const ROOM = 'spike-test-' + Date.now()
const WS_URL = 'ws://localhost:8080/yjs'
const TIMEOUT_MS = 10000

function waitForSync(provider) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('sync timeout')),
      TIMEOUT_MS,
    )
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
      () =>
        reject(
          new Error(
            `${label}: expected "${expected}", got "${ytext.toString()}"`,
          ),
        ),
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

const docA = new Y.Doc()
const docB = new Y.Doc()
const textA = docA.getText('content')
const textB = docB.getText('content')

const providerA = new WebsocketProvider(WS_URL, ROOM, docA)
const providerB = new WebsocketProvider(WS_URL, ROOM, docB)

try {
  await Promise.all([waitForSync(providerA), waitForSync(providerB)])

  textA.insert(0, 'Hello from tab A')
  await waitForText(textB, 'Hello from tab A', 'B after A insert')

  textB.insert(textB.length, ' + B')
  await waitForText(textA, 'Hello from tab A + B', 'A after B insert')

  console.log('PASS: Yjs ↔ ygo sync verified')
  console.log('  room:', ROOM)
  console.log('  final text:', textA.toString())
  process.exit(0)
} catch (err) {
  console.error('FAIL:', err.message)
  process.exit(1)
} finally {
  providerA.destroy()
  providerB.destroy()
  docA.destroy()
  docB.destroy()
}
