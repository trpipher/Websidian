import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap } from '@codemirror/commands'
import { wikilinkPlugin } from './wikilinkPlugin'

// history() intentionally omitted — Yjs UndoManager handles undo/redo
export function buildExtensions(onWikilinkClick?: (title: string) => void) {
  return [
    lineNumbers(),
    highlightActiveLine(),
    keymap.of([...defaultKeymap]),
    EditorView.theme({ '.cm-scroller': { paddingTop: '6px' } }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    oneDark,
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(true),
    ...(onWikilinkClick ? [wikilinkPlugin(onWikilinkClick)] : []),
  ]
}
