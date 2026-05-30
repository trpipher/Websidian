import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { type Awareness } from 'y-protocols/awareness'
import { keymap } from '@codemirror/view'
import * as Y from 'yjs'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { buildExtensions } from '../lib/codemirror'

interface Props {
  yText: Y.Text
  awareness: Awareness | null
  onWikilinkClick?: (title: string) => void
}

export default function Editor({ yText, awareness, onWikilinkClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const undoManager = new Y.UndoManager(yText)

    // Initialise CodeMirror with the current Yjs content so yCollab doesn't
    // see an empty document and push a delete-everything op back to the Yjs doc.
    let view: EditorView
    try {
      view = new EditorView({
        state: EditorState.create({
          doc: yText.toString(),
          extensions: [
            ...buildExtensions(onWikilinkClick),
            yCollab(yText, awareness, { undoManager }),
            keymap.of(yUndoManagerKeymap),
          ],
        }),
        parent: containerRef.current,
      })
    } catch (e) {
      undoManager.destroy()
      throw e
    }
    viewRef.current = view

    return () => {
      // @codemirror/lang-markdown schedules requestIdleCallbacks for async parsing.
      // Those callbacks can fire after view.destroy(), which throws because
      // updateState === Destroyed !== Idle. Silence them with a no-op dispatch.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(view as any).dispatch = () => {}
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
