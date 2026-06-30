/** WebSocket base URL for ygo sync (room name is appended by y-websocket). */
export function yjsWsBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/yjs`
}
