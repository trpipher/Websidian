import { Server } from '@hocuspocus/server'

export const hocuspocus = Server.configure({
  port: 1234,
  async onConnect({ documentName, context }) {
    console.log(`[sync] connect: ${documentName}`)
  },
  async onDisconnect({ documentName }) {
    console.log(`[sync] disconnect: ${documentName}`)
  },
})
