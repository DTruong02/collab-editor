import { useEffect, useState } from 'react'
import type { ConnectionStatus } from './useYjsDoc'

export type OnlineStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'offline'

type UseOnlineStatusOptions = {
  reconnectAttempts?: number
}

export function useOnlineStatus(
  wsStatus: ConnectionStatus | undefined,
  options: UseOnlineStatusOptions = {},
) {
  const { reconnectAttempts = 0 } = options
  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  )

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true)
    const onOffline = () => setBrowserOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const status: OnlineStatus = !browserOnline
    ? 'offline'
    : wsStatus === 'connected'
      ? 'connected'
      : wsStatus === 'connecting'
        ? 'connecting'
        : 'reconnecting'

  const message =
    status === 'offline'
      ? 'Offline — changes saved locally, will sync on reconnect'
      : status === 'reconnecting'
        ? reconnectAttempts > 0
          ? `Reconnecting… (attempt ${reconnectAttempts})`
          : 'Reconnecting…'
        : status === 'connecting'
          ? 'Connecting…'
          : 'Connected'

  return { browserOnline, status, message, reconnectAttempts }
}
