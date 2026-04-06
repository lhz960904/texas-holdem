import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AccessToken } from 'livekit-server-sdk'
import type { RoomManager } from '../rooms/room-manager'
import type { RoomConfig } from '@texas-holdem/shared'
import type { UserRepository } from '../db/user-repository'
import { signToken, verifyToken } from '../auth/jwt'

export function createApi(roomManager: RoomManager, userRepo: UserRepository) {
  const app = new Hono()

  app.use('*', cors())

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  // --- Auth ---
  app.post('/api/auth/login', async (c) => {
    const { username, password, avatar } = await c.req.json<{
      username: string
      password: string
      avatar?: string
    }>()

    if (!username?.trim() || !password) {
      return c.json({ error: '请输入账户名和密码' }, 400)
    }

    try {
      const { user, isNewUser } = await userRepo.loginOrRegister(
        username.trim(),
        password,
        avatar ?? ''
      )
      const token = signToken({ userId: user.id, username: user.username })
      return c.json({ token, user, isNewUser })
    } catch (e: any) {
      return c.json({ error: e.message }, 401)
    }
  })

  // --- Auth middleware helper ---
  function getUserFromToken(c: any): { userId: string; username: string } | null {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) return null
    return verifyToken(auth.slice(7))
  }

  // --- Get current user profile ---
  app.get('/api/auth/me', (c) => {
    const payload = getUserFromToken(c)
    if (!payload) return c.json({ error: 'Unauthorized' }, 401)
    const user = userRepo.findById(payload.userId)
    if (!user) return c.json({ error: 'User not found' }, 404)
    return c.json({ user })
  })

  // --- Update avatar ---
  app.put('/api/auth/avatar', async (c) => {
    const payload = getUserFromToken(c)
    if (!payload) return c.json({ error: 'Unauthorized' }, 401)
    const { avatar } = await c.req.json<{ avatar: string }>()
    userRepo.updateAvatar(payload.userId, avatar)
    return c.json({ ok: true })
  })

  // --- Rooms ---
  app.post('/api/rooms', async (c) => {
    const payload = getUserFromToken(c)
    if (!payload) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json<{ config: RoomConfig }>()
    const { config } = body

    if (!config) {
      return c.json({ error: 'config is required' }, 400)
    }

    const user = userRepo.findById(payload.userId)
    if (!user) return c.json({ error: 'User not found' }, 404)

    const room = roomManager.createRoom(user.id, config)
    roomManager.setHostInfo(room.id, user.nickname, user.avatar)

    return c.json({
      roomId: room.id,
      code: room.code,
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
