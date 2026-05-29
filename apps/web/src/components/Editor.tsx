import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { type Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { buildExtensions } from '../lib/codemirror'

interface Props {
  yText: Y.Text
  awareness: Awareness | null
}

export default function Editor({ yText, awareness }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const undoManager = new Y.UndoManager(yText)

    const extensions = buildExtensions(yText, awareness, undoManager)
    const state = EditorState.create({
      extensions,
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
      undoManager.destroy()
    }
  }, [yText, awareness])

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, height: '100%', overflow: 'auto' }}
    />
  )
}
