import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serve } from '@hono/node-server'
import { createApi } from '../api/routes'
import { RoomManager } from '../rooms/room-manager'
import { WsHandler } from '../ws/ws-handler'
import WebSocket from 'ws'

const PORT = 3099
let server: ReturnType<typeof serve>
let roomManager: RoomManager
let wsHandler: WsHandler

// Connect a WS client and wait for the __init__ message to get server-assigned playerId
function connectWs(): Promise<{ ws: WebSocket; playerId: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`)
    ws.on('error', reject)
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      // Server sends: { event: 'error', data: { message: '__init__:{playerId}' } }
      if (msg.event === 'error' && typeof msg.data?.message === 'string' && msg.data.message.startsWith('__init__:')) {
        const playerId = msg.data.message.slice('__init__:'.length)
        resolve({ ws, playerId })
      }
    })
  })
}

// Wait for a specific event on a WS connection
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

    // Fetch room by code
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

  it('connects players via WebSocket and receives assigned playerIds', async () => {
    const { ws, playerId } = await connectWs()
    expect(playerId).toBeTruthy()
    expect(playerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    ws.close()
  })

  it('full game flow: join room, start game, deal cards', async () => {
    // 1. Connect both WS clients first to get server-assigned playerIds
    const [conn1, conn2] = await Promise.all([connectWs(), connectWs()])
    const { ws: ws1, playerId: hostId } = conn1
    const { ws: ws2, playerId: p2Id } = conn2

    // 2. Create room in RoomManager using the host's server-assigned WS playerId
    //    so that start-game authorization works correctly
    const config = { blinds: { small: 10, big: 20 }, buyIn: 1000, maxPlayers: 6, turnTime: 30 }
    const room = roomManager.createRoom(hostId, config)
    roomManager.setHostInfo(room.id, 'Host', '🐺:#3498db')
    const { code } = room

    // 3. Host WS joins room — RoomManager recognises hostId and updates host info
    const roomStateP1 = waitForEvent(ws1, 'room-state')
    send(ws1, 'join-room', { code, nickname: 'Host', avatar: '🐺:#3498db' })
    const roomState1 = await roomStateP1
    expect(roomState1.room.code).toBe(code)
    expect(roomState1.room.players).toHaveLength(1)
    expect(roomState1.room.hostId).toBe(hostId)

    // 4. Player 2 WS joins room
    const roomStateP2 = waitForEvent(ws2, 'room-state')
    send(ws2, 'join-room', { code, nickname: 'Player2', avatar: '🦊:#e74c3c' })
    const roomState2 = await roomStateP2
    expect(roomState2.room.players).toHaveLength(2)

    // 5. Host starts game — both players should receive deal-cards
    const gameStartP1 = waitForEvent(ws1, 'game-start')
    const gameStartP2 = waitForEvent(ws2, 'game-start')
    const dealP1 = waitForEvent(ws1, 'deal-cards')
    const dealP2 = waitForEvent(ws2, 'deal-cards')

    send(ws1, 'start-game', {})

    const [gameStart1, , cards1, cards2] = await Promise.all([
      gameStartP1,
      gameStartP2,
      dealP1,
      dealP2,
    ])

    // Verify game-start event
    expect(gameStart1.blinds.small).toBe(10)
    expect(gameStart1.blinds.big).toBe(20)
    expect(typeof gameStart1.dealerSeat).toBe('number')

    // Verify each player received 2 hole cards
    expect(cards1.cards).toHaveLength(2)
    expect(cards2.cards).toHaveLength(2)

    // Cards should be objects with suit and rank
    for (const card of [...cards1.cards, ...cards2.cards]) {
      expect(card).toHaveProperty('suit')
      expect(card).toHaveProperty('rank')
    }

    // Cleanup
    ws1.close()
    ws2.close()
  }, 10000)

  it('emits error when joining non-existent room', async () => {
    const { ws, playerId: _ } = await connectWs()
    const errP = waitForEvent(ws, 'error')
    send(ws, 'join-room', { code: 'BADCOD', nickname: 'Ghost', avatar: '' })
    const err = await errP
    expect(err.message).toBeTruthy()
    ws.close()
  })

  it('emits error when non-host tries to start game', async () => {
    // Setup: create room with a fake hostId not matching any WS connection
    const fakeHostId = 'fake-host-id-not-ws'
    const config = { blinds: { small: 5, big: 10 }, buyIn: 500, maxPlayers: 6, turnTime: 30 }
    const room = roomManager.createRoom(fakeHostId, config)

    // Connect a non-host WS and join
    const { ws, playerId: p2Id } = await connectWs()
    const roomStateP = waitForEvent(ws, 'room-state')
    send(ws, 'join-room', { code: room.code, nickname: 'NotHost', avatar: '' })
    await roomStateP

    // Add a second player directly so there are 2 players
    roomManager.joinRoom(room.code, 'extra-player', 'Extra', '')

    // Non-host tries to start — should get error
    const errP = waitForEvent(ws, 'error')
    send(ws, 'start-game', {})
    const err = await errP
    expect(err.message).toMatch(/Only host|host/i)
    ws.close()
  }, 8000)
})
