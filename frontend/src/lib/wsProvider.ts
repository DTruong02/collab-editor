/** Shared y-websocket provider options for resilient reconnect behavior. */
export const WS_PROVIDER_OPTS = {
  connect: true,
  /** Exponential backoff cap — long enough to survive brief server restarts. */
  maxBackoffTime: 30_000,
  /** Periodically resync with server state after reconnect. */
  resyncInterval: 5_000,
} as const

export function mapProviderStatus(status: string): 'connecting' | 'connected' | 'disconnected' {
  if (status === 'connected') return 'connected'
  if (status === 'connecting') return 'connecting'
  return 'disconnected'
}
