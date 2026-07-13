import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { Awareness } from 'y-protocols/awareness'
import { userColorFromUsername } from '../lib/colors'
import { mapProviderStatus, WS_PROVIDER_OPTS } from '../lib/wsProvider'
import { yjsWsBaseUrl } from '../lib/wsUrl'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export type AwarenessUser = {
  clientId: number
  name: string
  color: string
  colorLight: string
  isLocal: boolean
}

type YjsDocState = {
  ytext: Y.Text
  awareness: Awareness
  synced: boolean
  connectionStatus: ConnectionStatus
  reconnectAttempts: number
  users: AwarenessUser[]
}

type AwarenessUserField = {
  name: string
  color: string
  colorLight: string
}

export function useYjsDoc(docId: string, username: string): YjsDocState | null {
  const enabled = Boolean(docId && username)
  const [state, setState] = useState<YjsDocState | null>(null)

  useEffect(() => {
    if (!enabled) return

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    const provider = new WebsocketProvider(
      yjsWsBaseUrl(),
      docId,
      ydoc,
      WS_PROVIDER_OPTS,
    )
    const { awareness } = provider
    const colors = userColorFromUsername(username)

    awareness.setLocalStateField('user', {
      name: username,
      color: colors.color,
      colorLight: colors.colorLight,
    } satisfies AwarenessUserField)

    const collectUsers = (): AwarenessUser[] => {
      const localClientId = awareness.clientID
      const users: AwarenessUser[] = []

      awareness.getStates().forEach((awarenessState, clientId) => {
        const user = awarenessState?.user as AwarenessUserField | undefined
        if (!user?.name) return
        users.push({
          clientId,
          name: user.name,
          color: user.color,
          colorLight: user.colorLight,
          isLocal: clientId === localClientId,
        })
      })

      return users.sort((a, b) => a.name.localeCompare(b.name))
    }

    const patchState = (patch: Partial<YjsDocState>) => {
      setState((prev) => ({
        ytext,
        awareness,
        synced: prev?.synced ?? provider.synced,
        connectionStatus: prev?.connectionStatus ?? 'connecting',
        reconnectAttempts: prev?.reconnectAttempts ?? 0,
        users: prev?.users ?? collectUsers(),
        ...patch,
      }))
    }

    const pauseReconnect = () => {
      provider.shouldConnect = false
      provider.disconnect()
      patchState({ connectionStatus: 'disconnected' })
    }

    const resumeReconnect = () => {
      provider.shouldConnect = true
      provider.connect()
    }

    const onBrowserOffline = () => pauseReconnect()
    const onBrowserOnline = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        resumeReconnect()
      }
    }

    window.addEventListener('offline', onBrowserOffline)
    window.addEventListener('online', onBrowserOnline)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      pauseReconnect()
    }

    const updateUsers = () => {
      patchState({ users: collectUsers() })
    }

    const onStatus = ({ status }: { status: string }) => {
      patchState({
        connectionStatus: mapProviderStatus(status),
        reconnectAttempts:
          status === 'connected' ? 0 : provider.wsUnsuccessfulReconnects,
      })
    }

    const onConnectionClose = () => {
      patchState({
        connectionStatus: 'disconnected',
        reconnectAttempts: provider.wsUnsuccessfulReconnects,
      })
    }

    const onConnectionError = () => {
      patchState({
        connectionStatus: 'disconnected',
        reconnectAttempts: provider.wsUnsuccessfulReconnects,
      })
    }

    const onSync = (isSynced: boolean) => {
      patchState({ synced: isSynced })
    }

    provider.on('status', onStatus)
    provider.on('connection-close', onConnectionClose)
    provider.on('connection-error', onConnectionError)
    provider.on('sync', onSync)
    awareness.on('change', updateUsers)

    return () => {
      window.removeEventListener('offline', onBrowserOffline)
      window.removeEventListener('online', onBrowserOnline)
      awareness.off('change', updateUsers)
      provider.off('status', onStatus)
      provider.off('connection-close', onConnectionClose)
      provider.off('connection-error', onConnectionError)
      provider.off('sync', onSync)
      provider.destroy()
      ydoc.destroy()
    }
  }, [enabled, docId, username])

  return enabled ? state : null
}
