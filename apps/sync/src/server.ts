import { Server } from '@hocuspocus/server'

const server = Server.configure({
  port: 1234,
  onConnect() {
    console.log('client connected')
  },
})

server.listen()
console.log('Hocuspocus listening on ws://localhost:1234')
