import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { randomUUID } from 'crypto'
import { AccessToken } from 'livekit-server-sdk'
import type { RoomManager } from '../rooms/room-manager'
import type { RoomConfig } from '@texas-holdem/shared'

export function createApi(roomManager: RoomManager) {
  const app = new Hono()

  app.use('*', cors())

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.post('/api/rooms', async (c) => {
    const body = await c.req.json<{ nickname: string; avatar: string; config: RoomConfig }>()
    const { nickname, avatar, config } = body

    if (!nickname || !config) {
      return c.json({ error: 'nickname and config are required' }, 400)
    }

    const hostId = randomUUID()
    const room = roomManager.createRoom(hostId, config)
    roomManager.setHostInfo(room.id, nickname, avatar)

    return c.json({
      roomId: room.id,
      code: room.code,
      playerId: hostId,
    })
  })

  app.get('/api/rooms/:code', (c) => {
    const code = c.req.param('code')
    const roomRef = roomManager.getRoomByCode(code)
    if (!roomRef) {
      return c.json({ error: 'Room not found' }, 404)
    }

    const state = roomManager.getRoomState(roomRef.id)
    if (!state) {
      return c.json({ error: 'Room not found' }, 404)
    }

    return c.json({
      code: state.code,
      playerCount: state.players.length,
      maxPlayers: state.config.maxPlayers,
      status: state.status,
    })
  })

  app.get('/api/rooms/:roomId/voice-token', async (c) => {
    const roomId = c.req.param('roomId')
    const playerId = c.req.query('playerId') ?? 'anonymous'
    const nickname = c.req.query('nickname') ?? playerId

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const wsUrl = process.env.LIVEKIT_URL

    if (!apiKey || !apiSecret || !wsUrl) {
      return c.json({ token: '', wsUrl: '' })
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: playerId,
      name: nickname,
    })
    token.addGrant({ room: roomId, roomJoin: true, canPublish: true, canSubscribe: true })
    return c.json({ token: await token.toJwt(), wsUrl })
  })

  return app
}
