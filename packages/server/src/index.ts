import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApi } from './api/routes'
import { RoomManager } from './rooms/room-manager'
import { WsHandler } from './ws/ws-handler'
import { UserRepository } from './db/user-repository'
import { existsSync } from 'fs'
import { resolve } from 'path'

const userRepo = new UserRepository()
const roomManager = new RoomManager()
const wsHandler = new WsHandler(roomManager, userRepo)
const api = createApi(roomManager, userRepo)

// In production, serve the built client files
const clientDist = resolve(process.cwd(), '..', 'client', 'dist')
if (existsSync(clientDist)) {
  console.log(`Serving static files from ${clientDist}`)
  // Serve static assets
  api.use('/*', serveStatic({ root: clientDist }))
  // SPA fallback — serve index.html for non-API/WS routes
  api.get('*', serveStatic({ root: clientDist, path: 'index.html' }))
}

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

function shutdown() {
  console.log('\nShutting down...')
  wsHandler.getWss().close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
