import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { type Awareness } from 'y-protocols/awareness'
import { keymap } from '@codemirror/view'
import * as Y from 'yjs'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
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

    const view = new EditorView({
      extensions: [
        ...buildExtensions(),
        yCollab(yText, awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
      ],
      parent: containerRef.current,
    })
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
