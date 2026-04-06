import { serve } from '@hono/node-server'
import { createApi } from './api/routes'
import { RoomManager } from './rooms/room-manager'
import { WsHandler } from './ws/ws-handler'

const roomManager = new RoomManager()
const wsHandler = new WsHandler(roomManager)
const api = createApi(roomManager)

const PORT = Number(process.env.PORT) || 3001

const server = serve({ fetch: api.fetch, port: PORT }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/ws')) {
    wsHandler.getWss().handleUpgrade(req, socket, head, (ws) => {
      wsHandler.getWss().emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down...')
  wsHandler.getWss().close()
  server.close(() => process.exit(0))
  // Force exit after 2s if close hangs
  setTimeout(() => process.exit(0), 2000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
