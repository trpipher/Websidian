import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { history } from '@codemirror/commands'
import { type Awareness } from 'y-protocols/awareness'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import * as Y from 'yjs'

export function buildExtensions(yText: Y.Text, awareness: Awareness | null, undoManager: Y.UndoManager) {
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    oneDark,
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(true),
    yCollab(yText, awareness, { undoManager }),
    yUndoManagerKeymap,
  ].flat() as any
}
