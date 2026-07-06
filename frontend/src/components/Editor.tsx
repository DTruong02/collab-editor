import { useCallback, useEffect, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

type EditorProps = {
  ytext: Y.Text
  awareness: Awareness
  synced: boolean
}

export function Editor({ ytext, awareness, synced }: EditorProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const setRef = useCallback((node: HTMLElement | null) => {
    setContainer(node)
  }, [])

  useEffect(() => {
    if (!container) return

    const undoManager = new Y.UndoManager(ytext)
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        javascript(),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '15px',
          },
          '.cm-scroller': {
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: '1.6',
          },
          '.cm-content': {
            padding: '16px 20px',
            minHeight: '100%',
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            borderRight: '1px solid var(--editor-border)',
          },
        }),
        yCollab(ytext, awareness, { undoManager }),
      ],
    })

    const view = new EditorView({ state, parent: container })

    return () => {
      view.destroy()
    }
  }, [container, ytext, awareness])

  return (
    <div className={`editor-shell${synced ? '' : ' editor-shell--loading'}`}>
      <div ref={setRef} className="editor" />
      {!synced ? <div className="editor-loading">Syncing document…</div> : null}
    </div>
  )
}
