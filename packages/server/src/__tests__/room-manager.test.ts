import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from '../rooms/room-manager'
import type { RoomConfig } from '@texas-holdem/shared'

const defaultConfig: RoomConfig = {
  blinds: { small: 10, big: 20 },
  buyIn: 1000,
  maxPlayers: 9,
  turnTime: 30,
}

describe('RoomManager', () => {
  let manager: RoomManager

  beforeEach(() => {
    manager = new RoomManager()
  })

  it('creates a room with a 6-char code', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    expect(room.id).toBeTruthy()
    expect(room.code).toHaveLength(6)
    expect(room.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    expect(room.hostId).toBe('host-1')
    expect(room.status).toBe('waiting')
  })

  it('finds room by code', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    const found = manager.getRoomByCode(room.code)
    expect(found).toBeDefined()
    expect(found!.id).toBe(room.id)
    expect(found!.code).toBe(room.code)

    // Case-insensitive
    const foundLower = manager.getRoomByCode(room.code.toLowerCase())
    expect(foundLower).toBeDefined()
    expect(foundLower!.id).toBe(room.id)
  })

  it('returns undefined for unknown code', () => {
    const found = manager.getRoomByCode('XXXXXX')
    expect(found).toBeUndefined()
  })

  it('adds player to room', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    const player = manager.joinRoom(room.code, 'player-2', 'Alice', 'avatar.png')
    expect(player.id).toBe('player-2')
    expect(player.nickname).toBe('Alice')
    expect(player.avatar).toBe('avatar.png')
    expect(player.chips).toBe(defaultConfig.buyIn)
    expect(player.seatIndex).toBe(1)

    const state = manager.getRoomState(room.id)
    expect(state!.players).toHaveLength(2)
  })

  it('rejects join when room is full', () => {
    const config: RoomConfig = { ...defaultConfig, maxPlayers: 2 }
    const room = manager.createRoom('host-1', config)
    manager.joinRoom(room.code, 'player-2', 'Alice', '')
    // Room now has 2 players (host + player-2), third should be rejected
    expect(() => manager.joinRoom(room.code, 'player-3', 'Bob', '')).toThrow('Room is full')
  })

  it('removes player and transfers host', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    manager.joinRoom(room.code, 'player-2', 'Alice', '')

    manager.leaveRoom(room.id, 'host-1')

    const state = manager.getRoomState(room.id)
    expect(state).toBeDefined()
    expect(state!.players).toHaveLength(1)
    expect(state!.hostId).toBe('player-2')
  })

  it('destroys room when last player leaves', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    const code = room.code

    manager.leaveRoom(room.id, 'host-1')

    const state = manager.getRoomState(room.id)
    expect(state).toBeUndefined()

    const found = manager.getRoomByCode(code)
    expect(found).toBeUndefined()
  })

  it('generates unique room codes (50 rooms)', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const room = manager.createRoom(`host-${i}`, defaultConfig)
      codes.add(room.code)
    }
    expect(codes.size).toBe(50)
  })

  it('host can start game with 2+ players', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    manager.joinRoom(room.code, 'player-2', 'Alice', '')

    manager.startGame(room.id, 'host-1')

    const state = manager.getRoomState(room.id)
    expect(state!.status).toBe('playing')
    expect(state!.game).not.toBeNull()
    expect(state!.game!.phase).toBe('preflop')
  })

  it('non-host cannot start game', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    manager.joinRoom(room.code, 'player-2', 'Alice', '')

    expect(() => manager.startGame(room.id, 'player-2')).toThrow('Only host can start the game')
  })

  it('cannot start game with fewer than 2 players', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    expect(() => manager.startGame(room.id, 'host-1')).toThrow('Need at least 2 players')
  })

  it('toggleReady flips ready state', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    const result1 = manager.toggleReady(room.id, 'host-1')
    expect(result1).toBe(true)

    const result2 = manager.toggleReady(room.id, 'host-1')
    expect(result2).toBe(false)
  })

  it('getPlayerRoom finds the room for a player', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    manager.joinRoom(room.code, 'player-2', 'Alice', '')

    const found = manager.getPlayerRoom('player-2')
    expect(found).toBeDefined()
    expect(found!.id).toBe(room.id)

    expect(manager.getPlayerRoom('unknown')).toBeUndefined()
  })

  it('getEngine returns null before game starts', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    expect(manager.getEngine(room.id)).toBeNull()
  })

  it('getEngine returns engine after game starts', () => {
    const room = manager.createRoom('host-1', defaultConfig)
    manager.joinRoom(room.code, 'player-2', 'Alice', '')
    manager.startGame(room.id, 'host-1')

    const engine = manager.getEngine(room.id)
    expect(engine).not.toBeNull()
  })
})
