import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Group 1: target (path or title, e.g. "Folder/Note" or "Note")
// Group 2: optional display alias (e.g. "Display Name")
const WIKILINK_RE = /\[\[([^\]\n|]+?)(?:\|([^\]\n]+))?\]\]/g

class WikilinkWidget extends WidgetType {
  constructor(
    private target: string,
    private display: string,
    private onClick: (target: string) => void,
  ) {
    super()
  }
  toDOM() {
    const span = document.createElement('span')
    span.textContent = this.display
    span.style.cssText = 'color:#89b4fa;cursor:pointer;text-decoration:underline dotted'
    span.onclick = () => this.onClick(this.target)
    return span
  }
  eq(other: WikilinkWidget) {
    return other.target === this.target && other.display === this.display
  }
}

export function wikilinkPlugin(onNavigate: (target: string) => void) {
  return ViewPlugin.fromClass(
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
            const target = match[1]
            const alias = match[2]
            // Show alias if present, otherwise show [[target]]
            const display = alias ?? `[[${target}]]`
            const start = from + match.index
            const end = start + match[0].length
            builder.add(start, end, Decoration.replace({
              widget: new WikilinkWidget(target, display, onNavigate),
            }))
          }
        }
        return builder.finish()
      }
    },
    { decorations: (v) => v.decorations }
  )
}
