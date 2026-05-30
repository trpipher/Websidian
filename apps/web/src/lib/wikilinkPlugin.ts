import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Group 1: target; Group 2: optional alias. [ excluded so nested [[ breaks the match.
const WIKILINK_RE = /\[\[([^\]\n\[|]+?)(?:\|([^\]\n\[]+))?\]\]/g

/** Find the wikilink target at a given document position, or null if none. */
function wikilinkTargetAtPos(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos)
  WIKILINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(line.text)) !== null) {
    const start = line.from + match.index
    const end = start + match[0].length
    if (pos >= start && pos <= end) return match[1]
  }
  return null
}

export function wikilinkPlugin(onNavigate: (target: string) => void) {
  return [
    // Mark decorations: style wikilinks without replacing the text, so the
    // cursor can move freely inside them (unlike Decoration.replace).
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view)
          }
        }

        buildDecorations(view: EditorView): DecorationSet {
          const builder = new RangeSetBuilder<Decoration>()
          for (const { from, to } of view.visibleRanges) {
            const text = view.state.sliceDoc(from, to)
            WIKILINK_RE.lastIndex = 0
            let match: RegExpExecArray | null
            while ((match = WIKILINK_RE.exec(text)) !== null) {
              const start = from + match.index
              const end = start + match[0].length
              builder.add(start, end, Decoration.mark({ class: 'cm-wikilink' }))
            }
          }
          return builder.finish()
        }
      },
      { decorations: (v) => v.decorations },
    ),

    // Ctrl+Click (or Cmd+Click on Mac) navigates; plain click just moves the cursor.
    EditorView.domEventHandlers({
      click(event, view) {
        if (!event.ctrlKey && !event.metaKey) return false
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return false
        const target = wikilinkTargetAtPos(view, pos)
        if (target) {
          onNavigate(target)
          return true
        }
        return false
      },
    }),

    // Wikilink style — cursor stays as text so the user knows they can type inside.
    EditorView.baseTheme({
      '.cm-wikilink': {
        color: '#89b4fa',
        textDecoration: 'underline dotted',
      },
    }),
  ]
}
