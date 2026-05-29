import { Server } from '@hocuspocus/server'
import { fetchDocument, storeDocument } from './persistence.js'

export const hocuspocus = Server.configure({
  port: 1234,

  async onLoadDocument({ document, documentName }) {
    const stored = fetchDocument(documentName)
    if (stored) {
      const { applyUpdate } = await import('yjs')
      applyUpdate(document, stored)
    }
    return document
  },

  async onStoreDocument({ document, documentName }) {
    storeDocument(documentName, document)
  },

  async onConnect({ documentName, context }) {
    console.log(`[sync] connect: ${documentName}`)
  },

  async onDisconnect({ documentName }) {
    console.log(`[sync] disconnect: ${documentName}`)
  },
})
