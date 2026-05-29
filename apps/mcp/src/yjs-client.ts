import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import WebSocket from 'ws'
import * as Y from 'yjs'

const SYNC_URL = process.env.SYNC_URL ?? 'ws://localhost:1234'
const AI_BOT_TOKEN = process.env.AI_BOT_TOKEN ?? 'dev-ai-bot-token'
const BOT_NAME = 'AI Assistant'
const BOT_COLOR = '#cba6f7'

export interface YjsClient {
  doc: Y.Doc
  yText: Y.Text
  provider: HocuspocusProvider
  destroy: () => void
}

export function openYjsDoc(noteId: string): Promise<YjsClient> {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc()

    const websocketProvider = new HocuspocusProviderWebsocket({
      url: SYNC_URL,
      WebSocketPolyfill: WebSocket as any,
    })

    const provider = new HocuspocusProvider({
      websocketProvider,
      name: noteId,
      document: doc,
      token: AI_BOT_TOKEN,
      onSynced() {
        provider.setAwarenessField('user', { name: BOT_NAME, color: BOT_COLOR })
        resolve({
          doc,
          yText: doc.getText('content'),
          provider,
          destroy: () => {
            provider.destroy()
            websocketProvider.destroy()
            doc.destroy()
          },
        })
      },
    })

    setTimeout(() => {
      reject(new Error(`Yjs sync timeout for note ${noteId}`))
      provider.destroy()
      websocketProvider.destroy()
      doc.destroy()
    }, 15_000)
  })
}

export function applyMinimalDiff(yText: Y.Text, newContent: string): void {
  const current = yText.toString()
  if (current === newContent) return

  let start = 0
  while (start < current.length && start < newContent.length && current[start] === newContent[start]) {
    start++
  }

  let endOld = current.length
  let endNew = newContent.length
  while (endOld > start && endNew > start && current[endOld - 1] === newContent[endNew - 1]) {
    endOld--
    endNew--
  }

  yText.doc!.transact(() => {
    if (endOld > start) yText.delete(start, endOld - start)
    if (endNew > start) yText.insert(start, newContent.slice(start, endNew))
  })
}
