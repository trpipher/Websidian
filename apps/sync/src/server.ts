import { Server } from '@hocuspocus/server'

const server = Server.configure({
  port: 1234,
  async onConnect() {
    console.log('client connected')
  },
})

server.listen().then(() => {
  console.log('Hocuspocus listening on ws://localhost:1234')
})
