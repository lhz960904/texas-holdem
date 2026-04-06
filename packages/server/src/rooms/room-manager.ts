import { randomUUID } from 'crypto'
import type { PlayerInfo, RoomConfig, RoomState, RoomStatus } from '@texas-holdem/shared'
import { GameEngine, type SettleResult } from '../engine/game-engine'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

interface Room {
  id: string
  code: string
  hostId: string
  status: RoomStatus
  config: RoomConfig
  players: Map<string, PlayerInfo>
  engine: GameEngine | null
  destroyTimer: ReturnType<typeof setTimeout> | null
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map()
  private codeIndex: Map<string, string> = new Map() // code -> roomId

  private generateCode(): string {
    while (true) {
      let code = ''
      for (let i = 0; i < 6; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      }
      if (!this.codeIndex.has(code)) return code
    }
  }

  createRoom(hostId: string, config: RoomConfig): Room {
    const id = randomUUID()
    const code = this.generateCode()

    const hostPlayer: PlayerInfo = {
      id: hostId,
      nickname: hostId,
      avatar: '',
      seatIndex: 0,
      chips: 0, // will be set from user balance on WS join
      status: 'sitting',
      isReady: false,
      isConnected: true,
    }

    const players = new Map<string, PlayerInfo>()
    players.set(hostId, hostPlayer)

    const room: Room = {
      id,
      code,
      hostId,
      status: 'waiting',
      config,
      players,
      engine: null,
      destroyTimer: null,
    }

    this.rooms.set(id, room)
    this.codeIndex.set(code, id)

    return room
  }

  getRoomByCode(code: string): { id: string; code: string } | undefined {
    const upper = code.toUpperCase()
    const roomId = this.codeIndex.get(upper)
    if (!roomId) return undefined
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    return { id: room.id, code: room.code }
  }

  joinRoom(code: string, playerId: string, nickname: string, avatar: string): { player: PlayerInfo; isReconnect: boolean } {
    const upper = code.toUpperCase()
    const roomId = this.codeIndex.get(upper)
    if (!roomId) throw new Error('Room not found')

    const room = this.rooms.get(roomId)
    if (!room) throw new Error('Room not found')

    // If player is already in the room (e.g. host or reconnect), just update info
    if (room.players.has(playerId)) {
      const existing = room.players.get(playerId)!
      existing.nickname = nickname
      existing.avatar = avatar
      return { player: existing, isReconnect: true }
    }

    if (room.status === 'playing') throw new Error('Game already started')
    if (room.players.size >= room.config.maxPlayers) throw new Error('Room is full')

    // Find next available seat
    const usedSeats = new Set([...room.players.values()].map(p => p.seatIndex))
    let seatIndex = 0
    while (usedSeats.has(seatIndex)) seatIndex++

    const player: PlayerInfo = {
      id: playerId,
      nickname,
      avatar,
      seatIndex,
      chips: 0, // will be set from user balance on WS join
      status: 'sitting',
      isReady: false,
      isConnected: true,
    }

    room.players.set(playerId, player)
    return { player, isReconnect: false }
  }

  leaveRoom(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.players.delete(playerId)

    if (room.players.size === 0) {
      this.destroyRoom(roomId)
      return
    }

    // Transfer host if needed
    if (room.hostId === playerId) {
      const nextPlayer = [...room.players.values()][0]
      room.hostId = nextPlayer.id
    }
  }

  private destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    if (room.destroyTimer) clearTimeout(room.destroyTimer)
    this.codeIndex.delete(room.code)
    this.rooms.delete(roomId)
  }

  getRoomState(roomId: string): RoomState | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined

    return {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      config: room.config,
      players: [...room.players.values()],
      game: room.engine ? room.engine.getState() : null,
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  setHostInfo(roomId: string, nickname: string, avatar: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    const host = room.players.get(room.hostId)
    if (!host) return
    host.nickname = nickname
    host.avatar = avatar
  }

  toggleReady(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('Room not found')
    const player = room.players.get(playerId)
    if (!player) throw new Error('Player not found')
    player.isReady = !player.isReady
    return player.isReady
  }

  startGame(roomId: string, requesterId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) throw new Error('Room not found')
    if (room.hostId !== requesterId) throw new Error('Only host can start the game')

    const activePlayers = [...room.players.values()].filter(p => p.chips > 0)
    if (activePlayers.length < 2) throw new Error('筹码充足的玩家不足2人，无法开始')

    room.status = 'playing'

    // Determine next dealer seat
    let dealerSeat: number
    const seats = activePlayers.map(p => p.seatIndex).sort((a, b) => a - b)

    if (room.engine) {
      // Subsequent hand — move dealer, reuse engine with updated chips
      const prevDealer = room.engine.getState().dealerSeat
      const prevIdx = seats.indexOf(prevDealer)
      dealerSeat = seats[(prevIdx + 1) % seats.length]

      // Re-add only players with chips
      for (const player of room.players.values()) {
        room.engine.removePlayer(player.seatIndex)
      }
      for (const player of activePlayers) {
        room.engine.addPlayer(player.seatIndex, player.id, player.chips)
      }
    } else {
      // First hand — create new engine
      room.engine = new GameEngine(room.config.blinds.small, room.config.blinds.big)
      for (const player of activePlayers) {
        room.engine.addPlayer(player.seatIndex, player.id, player.chips)
      }
      dealerSeat = seats[0]
    }

    room.engine.startHand(dealerSeat)
  }

  getEngine(roomId: string): GameEngine | null {
    return this.rooms.get(roomId)?.engine ?? null
  }

  getPlayerRoom(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) return room
    }
    return undefined
  }
}
