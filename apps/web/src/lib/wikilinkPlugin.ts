import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

class WikilinkWidget extends WidgetType {
  constructor(private title: string, private onClick: (title: string) => void) {
    super()
  }
  toDOM() {
    const span = document.createElement('span')
    span.textContent = `[[${this.title}]]`
    span.style.cssText = 'color:#89b4fa;cursor:pointer;text-decoration:underline dotted'
    span.onclick = () => this.onClick(this.title)
    return span
  }
  eq(other: WikilinkWidget) {
    return other.title === this.title
  }
}

export function wikilinkPlugin(onNavigate: (title: string) => void) {
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
            const start = from + match.index
            const end = start + match[0].length
            builder.add(start, end, Decoration.replace({
              widget: new WikilinkWidget(match[1], onNavigate),
            }))
          }
        }
        return builder.finish()
      }
    },
    { decorations: (v) => v.decorations }
  )
}
