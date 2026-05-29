import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import * as Y from 'yjs'
import { buildExtensions } from '../lib/codemirror'

interface Props {
  yText: Y.Text
}

export default function Editor({ yText }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      doc: yText.toString(),
      extensions: [
        ...buildExtensions(),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          const newContent = update.state.doc.toString()
          if (newContent === yText.toString()) return
          yText.doc?.transact(() => {
            yText.delete(0, yText.length)
            yText.insert(0, newContent)
          }, 'cm-update')
        }),
      ],
      parent: containerRef.current,
    })
    viewRef.current = view

    const observer = () => {
      const ycontent = yText.toString()
      const cmcontent = view.state.doc.toString()
      if (ycontent !== cmcontent) {
        view.dispatch({ changes: { from: 0, to: cmcontent.length, insert: ycontent } })
      }
    }
    yText.observe(observer)

    return () => {
      view.destroy()
      viewRef.current = null
      yText.unobserve(observer)
    }
  }, [yText])

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, height: '100%', overflow: 'auto' }}
    />
  )
}
