import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { Awareness } from 'y-protocols/awareness'
import { userColorFromUsername } from '../lib/colors'
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
    const provider = new WebsocketProvider(yjsWsBaseUrl(), docId, ydoc, {
      connect: true,
    })
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
        users: prev?.users ?? collectUsers(),
        ...patch,
      }))
    }

    const updateUsers = () => {
      patchState({ users: collectUsers() })
    }

    const onStatus = ({ status }: { status: string }) => {
      patchState({
        connectionStatus: status === 'connected' ? 'connected' : 'disconnected',
      })
    }

    const onSync = (isSynced: boolean) => {
      patchState({ synced: isSynced })
    }

    provider.on('status', onStatus)
    provider.on('sync', onSync)
    awareness.on('change', updateUsers)

    return () => {
      awareness.off('change', updateUsers)
      provider.off('status', onStatus)
      provider.off('sync', onSync)
      provider.destroy()
      ydoc.destroy()
    }
  }, [enabled, docId, username])

  return enabled ? state : null
}
