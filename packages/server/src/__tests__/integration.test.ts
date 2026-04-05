import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serve } from '@hono/node-server'
import { randomUUID } from 'crypto'
import { createApi } from '../api/routes'
import { RoomManager } from '../rooms/room-manager'
import { WsHandler } from '../ws/ws-handler'
import WebSocket from 'ws'

const PORT = 3099
let server: ReturnType<typeof serve>
let roomManager: RoomManager
let wsHandler: WsHandler

function connectWs(playerId?: string): Promise<{ ws: WebSocket; playerId: string }> {
  const id = playerId || randomUUID()
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws?playerId=${id}`)
    ws.on('open', () => resolve({ ws, playerId: id }))
    ws.on('error', reject)
  })
}

function waitForEvent(ws: WebSocket, eventName: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timeout waiting for event "${eventName}"`)),
      timeoutMs,
    )
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString())
      if (msg.event === eventName) {
        clearTimeout(timeout)
        ws.off('message', handler)
        resolve(msg.data)
      }
    }
    ws.on('message', handler)
  })
}

function send(ws: WebSocket, event: string, data: any) {
  ws.send(JSON.stringify({ event, data }))
}

describe('Integration: full game flow', () => {
  beforeAll(() => {
    roomManager = new RoomManager()
    wsHandler = new WsHandler(roomManager)
    const api = createApi(roomManager)
    server = serve({ fetch: api.fetch, port: PORT })
    server.on('upgrade', (req: any, socket: any, head: any) => {
      if (req.url?.startsWith('/ws')) {
        wsHandler.getWss().handleUpgrade(req, socket, head, (ws: any) => {
          wsHandler.getWss().emit('connection', ws, req)
        })
      } else {
        socket.destroy()
      }
    })
  })

  afterAll(() => {
    server.close()
  })

  it('health endpoint works', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/health`)
    const data = await res.json()
    expect(data.status).toBe('ok')
  })

  it('creates a room via API and retrieves it by code', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'TestHost',
        avatar: '🐺:#3498db',
        config: { blinds: { small: 10, big: 20 }, buyIn: 1000, maxPlayers: 6, turnTime: 30 },
      }),
    })
    expect(res.status).toBe(200)
    const { roomId, code, playerId } = await res.json()
    expect(roomId).toBeTruthy()
    expect(code).toHaveLength(6)
    expect(playerId).toBeTruthy()

    const roomRes = await fetch(`http://localhost:${PORT}/api/rooms/${code}`)
    expect(roomRes.status).toBe(200)
    const roomData = await roomRes.json()
    expect(roomData.code).toBe(code)
    expect(roomData.status).toBe('waiting')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'NoConfig' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 404 for unknown room code', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/rooms/ZZZZZZ`)
    expect(res.status).toBe(404)
  })

  it('full game flow: create room, join via WS, start, deal cards', async () => {
    // 1. Create room via API — get the host playerId
    const createRes = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'Host',
        avatar: '🐺:#3498db',
        config: { blinds: { small: 10, big: 20 }, buyIn: 1000, maxPlayers: 6, turnTime: 30 },
      }),
    })
    const { code, playerId: hostId } = await createRes.json()

    // 2. Host connects WS with the SAME playerId from API
    const { ws: ws1 } = await connectWs(hostId)
    const roomStateP1 = waitForEvent(ws1, 'room-state')
    send(ws1, 'join-room', { code, nickname: 'Host', avatar: '🐺:#3498db' })
    const roomState1 = await roomStateP1
    expect(roomState1.room.code).toBe(code)
    expect(roomState1.room.players).toHaveLength(1)

    // 3. Player 2 connects and joins
    const p2Id = randomUUID()
    const { ws: ws2 } = await connectWs(p2Id)
    const roomStateP2 = waitForEvent(ws2, 'room-state')
    send(ws2, 'join-room', { code, nickname: 'Player2', avatar: '🦊:#e74c3c' })
    const roomState2 = await roomStateP2
    expect(roomState2.room.players).toHaveLength(2)

    // 4. Host starts game
    const dealP1 = waitForEvent(ws1, 'deal-cards')
    const dealP2 = waitForEvent(ws2, 'deal-cards')
    send(ws1, 'start-game', {})

    const [cards1, cards2] = await Promise.all([dealP1, dealP2])
    expect(cards1.cards).toHaveLength(2)
    expect(cards2.cards).toHaveLength(2)

    for (const card of [...cards1.cards, ...cards2.cards]) {
      expect(card).toHaveProperty('suit')
      expect(card).toHaveProperty('rank')
    }

    ws1.close()
    ws2.close()
  }, 10000)

  it('emits error when joining non-existent room', async () => {
    const { ws } = await connectWs()
    const errP = waitForEvent(ws, 'error')
    send(ws, 'join-room', { code: 'BADCOD', nickname: 'Ghost', avatar: '' })
    const err = await errP
    expect(err.message).toBeTruthy()
    ws.close()
  })

  it('emits error when non-host tries to start game', async () => {
    // Create room with a host
    const createRes = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'RealHost',
        avatar: '🐺:#3498db',
        config: { blinds: { small: 5, big: 10 }, buyIn: 500, maxPlayers: 6, turnTime: 30 },
      }),
    })
    const { code } = await createRes.json()

    // Connect a non-host player
    const { ws } = await connectWs()
    const roomStateP = waitForEvent(ws, 'room-state')
    send(ws, 'join-room', { code, nickname: 'NotHost', avatar: '' })
    await roomStateP

    // Non-host tries to start
    const errP = waitForEvent(ws, 'error')
    send(ws, 'start-game', {})
    const err = await errP
    expect(err.message).toMatch(/host/i)
    ws.close()
  }, 8000)
})
