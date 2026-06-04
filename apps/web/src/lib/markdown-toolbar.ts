// apps/web/src/lib/markdown-toolbar.ts
import { EditorView } from '@codemirror/view'

export type FormatAction = 'bold' | 'italic' | 'heading' | 'wikilink' | 'link' | 'code' | 'divider'

export function formatMarkdown(view: EditorView, action: FormatAction): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  switch (action) {
    case 'bold': {
      const text = selected || 'bold text'
      view.dispatch({
        changes: { from, to, insert: `**${text}**` },
        selection: { anchor: from + 2, head: from + 2 + text.length },
      })
      break
    }
    case 'italic': {
      const text = selected || 'italic text'
      view.dispatch({
        changes: { from, to, insert: `*${text}*` },
        selection: { anchor: from + 1, head: from + 1 + text.length },
      })
      break
    }
    case 'heading': {
      const line = view.state.doc.lineAt(from)
      const lineText = view.state.sliceDoc(line.from, line.to)
      if (lineText.startsWith('# ')) {
        view.dispatch({ changes: { from: line.from, to: line.from + 2, insert: '' } })
      } else {
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '# ' } })
      }
      break
    }
    case 'wikilink': {
      const text = selected || 'note name'
      view.dispatch({
        changes: { from, to, insert: `[[${text}]]` },
        selection: { anchor: from + 2, head: from + 2 + text.length },
      })
      break
    }
    case 'link': {
      if (selected) {
        view.dispatch({
          changes: { from, to, insert: `[${selected}](url)` },
          selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
        })
      } else {
        view.dispatch({
          changes: { from, to, insert: '[text](url)' },
          selection: { anchor: from + 1, head: from + 5 },
        })
      }
      break
    }
    case 'code': {
      const text = selected || 'code'
      view.dispatch({
        changes: { from, to, insert: `\`${text}\`` },
        selection: { anchor: from + 1, head: from + 1 + text.length },
      })
      break
    }
    case 'divider': {
      const lineEnd = view.state.doc.lineAt(from).to
      view.dispatch({ changes: { from: lineEnd, to: lineEnd, insert: '\n---\n' } })
      break
    }
  }
  view.focus()
}
