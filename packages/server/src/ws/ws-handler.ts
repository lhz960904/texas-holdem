import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import type { RoomManager } from '../rooms/room-manager'
import type {
  ClientEventName,
  ClientEvents,
  ServerEventName,
  ServerEvents,
  WSMessage,
} from '@texas-holdem/shared'

interface PlayerConnection {
  ws: WebSocket
  playerId: string
  roomId: string | null
}

export class WsHandler {
  private wss: WebSocketServer
  private connections: Map<WebSocket, PlayerConnection> = new Map()
  private playerSockets: Map<string, WebSocket> = new Map()
  private turnTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private roomManager: RoomManager

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager
    this.wss = new WebSocketServer({ noServer: true })
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Use playerId from query param if provided, otherwise generate one
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      const playerId = url.searchParams.get('playerId') || randomUUID()

      const conn: PlayerConnection = { ws, playerId, roomId: null }
      this.connections.set(ws, conn)
      this.playerSockets.set(playerId, ws)

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as WSMessage
          this.handleMessage(ws, conn, msg)
        } catch {
          this.send(ws, 'error', { message: 'Invalid message format' })
        }
      })

      ws.on('close', () => {
        this.handleDisconnect(ws, conn)
      })

      ws.on('error', () => {
        this.handleDisconnect(ws, conn)
      })
    })
  }

  getWss(): WebSocketServer {
    return this.wss
  }

  private handleMessage(ws: WebSocket, conn: PlayerConnection, msg: WSMessage): void {
    const { event, data } = msg

    switch (event as ClientEventName) {
      case 'join-room':
        this.onJoinRoom(ws, conn, data as ClientEvents['join-room'])
        break
      case 'player-ready':
        this.onPlayerReady(ws, conn)
        break
      case 'start-game':
        this.onStartGame(ws, conn)
        break
      case 'action':
        this.onAction(ws, conn, data as ClientEvents['action'])
        break
      case 'leave-room':
        this.onLeaveRoom(ws, conn)
        break
      case 'show-cards':
        this.onShowCards(ws, conn)
        break
      default:
        this.send(ws, 'error', { message: `Unknown event: ${event}` })
    }
  }

  private onJoinRoom(ws: WebSocket, conn: PlayerConnection, data: ClientEvents['join-room']): void {
    try {
      const { code, nickname, avatar } = data
      const player = this.roomManager.joinRoom(code, conn.playerId, nickname, avatar)
      const roomRef = this.roomManager.getRoomByCode(code)
      if (!roomRef) {
        this.send(ws, 'error', { message: 'Room not found after join' })
        return
      }
      conn.roomId = roomRef.id

      const state = this.roomManager.getRoomState(roomRef.id)!
      this.send(ws, 'room-state', {
        room: state,
        hands: [],
        myCards: undefined,
      })

      this.broadcastToRoom(roomRef.id, 'player-joined', { player }, conn.playerId)
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to join room' })
    }
  }

  private onPlayerReady(ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' })
      return
    }
    try {
      this.roomManager.toggleReady(conn.roomId, conn.playerId)
      const state = this.roomManager.getRoomState(conn.roomId)!
      this.broadcastToRoom(conn.roomId, 'room-state', {
        room: state,
        hands: [],
      })
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to toggle ready' })
    }
  }

  private onStartGame(ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' })
      return
    }
    try {
      this.roomManager.startGame(conn.roomId, conn.playerId)

      const room = this.roomManager.getRoom(conn.roomId)!
      const engine = this.roomManager.getEngine(conn.roomId)!
      const gameState = engine.getState()

      // Broadcast game-start to all
      this.broadcastToRoom(conn.roomId, 'game-start', {
        dealerSeat: gameState.dealerSeat,
        blinds: { small: room.config.blinds.small, big: room.config.blinds.big },
      })

      // Send private deal-cards to each player
      for (const player of room.players.values()) {
        const playerWs = this.playerSockets.get(player.id)
        if (playerWs) {
          const cards = engine.getPlayerCards(player.seatIndex)
          if (cards) {
            this.send(playerWs, 'deal-cards', { cards })
          }
        }
      }

      // Broadcast turn info
      if (gameState.currentTurn >= 0) {
        this.broadcastToRoom(conn.roomId, 'turn', {
          seatIndex: gameState.currentTurn,
          deadline: gameState.turnDeadline,
          minRaise: engine.getMinRaise(),
          currentBet: engine.getCurrentBet(),
        })
        this.startTurnTimer(conn.roomId, gameState.currentTurn, room.config.turnTime)
      }
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to start game' })
    }
  }

  private onAction(ws: WebSocket, conn: PlayerConnection, data: ClientEvents['action']): void {
    if (!conn.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' })
      return
    }
    try {
      const engine = this.roomManager.getEngine(conn.roomId)
      if (!engine) {
        this.send(ws, 'error', { message: 'Game not started' })
        return
      }

      const room = this.roomManager.getRoom(conn.roomId)!
      // Find the seat index for this player
      const playerInfo = room.players.get(conn.playerId)
      if (!playerInfo) {
        this.send(ws, 'error', { message: 'Player not found in room' })
        return
      }

      this.clearTurnTimer(conn.roomId)

      const success = engine.handleAction(playerInfo.seatIndex, data.type, data.amount)
      if (!success) {
        this.send(ws, 'error', { message: 'Invalid action' })
        return
      }

      const gameState = engine.getState()

      this.broadcastToRoom(conn.roomId, 'player-action', {
        seatIndex: playerInfo.seatIndex,
        type: data.type,
        amount: data.amount ?? 0,
        pot: gameState.pot,
      })

      const phase = engine.getPhase()

      if (phase === 'settle') {
        const settleResult = engine.settle()

        if (settleResult.showdown && settleResult.showdownResults) {
          this.broadcastToRoom(conn.roomId, 'showdown', {
            results: settleResult.showdownResults.map(r => ({
              seatIndex: r.seatIndex,
              cards: r.cards,
              handRank: r.handRank as any,
              handName: r.handName,
            })),
          })
        }

        this.broadcastToRoom(conn.roomId, 'settle', {
          winners: settleResult.winners,
          showCards: settleResult.showdown,
        })
      } else if (phase === 'showdown') {
        // showdown phase: all cards dealt, engine will settle after broadcasting
        const settleResult = engine.settle()

        this.broadcastToRoom(conn.roomId, 'showdown', {
          results: (settleResult.showdownResults ?? []).map(r => ({
            seatIndex: r.seatIndex,
            cards: r.cards,
            handRank: r.handRank as any,
            handName: r.handName,
          })),
        })

        this.broadcastToRoom(conn.roomId, 'settle', {
          winners: settleResult.winners,
          showCards: true,
        })
      } else {
        // Normal phase change or same phase, broadcast updated turn
        const updatedState = engine.getState()
        const prevGameState = gameState

        if (updatedState.phase !== prevGameState.phase) {
          this.broadcastToRoom(conn.roomId, 'phase-change', {
            phase: updatedState.phase,
            communityCards: updatedState.communityCards,
          })
        }

        if (updatedState.currentTurn >= 0) {
          this.broadcastToRoom(conn.roomId, 'turn', {
            seatIndex: updatedState.currentTurn,
            deadline: updatedState.turnDeadline,
            minRaise: engine.getMinRaise(),
            currentBet: engine.getCurrentBet(),
          })
          this.startTurnTimer(conn.roomId, updatedState.currentTurn, room.config.turnTime)
        }
      }
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to handle action' })
    }
  }

  private onLeaveRoom(_ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) return
    const roomId = conn.roomId
    const seatIndex = this.roomManager.getRoom(roomId)?.players.get(conn.playerId)?.seatIndex ?? -1

    this.roomManager.leaveRoom(roomId, conn.playerId)
    conn.roomId = null

    if (seatIndex >= 0) {
      this.broadcastToRoom(roomId, 'player-left', { seatIndex })
    }
  }

  private onShowCards(_ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) return
    const engine = this.roomManager.getEngine(conn.roomId)
    if (!engine) return

    const room = this.roomManager.getRoom(conn.roomId)
    const playerInfo = room?.players.get(conn.playerId)
    if (!playerInfo) return

    const cards = engine.getPlayerCards(playerInfo.seatIndex)
    if (!cards) return

    this.broadcastToRoom(conn.roomId, 'cards-revealed', {
      seatIndex: playerInfo.seatIndex,
      cards,
    })
  }

  private handleDisconnect(_ws: WebSocket, conn: PlayerConnection): void {
    if (conn.roomId) {
      const room = this.roomManager.getRoom(conn.roomId)
      const playerInfo = room?.players.get(conn.playerId)
      if (playerInfo) {
        playerInfo.isConnected = false
      }
    }
    this.playerSockets.delete(conn.playerId)
    this.connections.delete(_ws)
  }

  private startTurnTimer(roomId: string, seatIndex: number, turnTime: number): void {
    this.clearTurnTimer(roomId)
    const timer = setTimeout(() => {
      this.autoFold(roomId, seatIndex)
    }, turnTime * 1000)
    this.turnTimers.set(roomId, timer)
  }

  private clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.turnTimers.delete(roomId)
    }
  }

  private autoFold(roomId: string, seatIndex: number): void {
    const engine = this.roomManager.getEngine(roomId)
    if (!engine) return
    if (engine.getState().currentTurn !== seatIndex) return

    const room = this.roomManager.getRoom(roomId)
    if (!room) return

    const success = engine.handleAction(seatIndex, 'fold')
    if (!success) return

    const gameState = engine.getState()

    this.broadcastToRoom(roomId, 'player-action', {
      seatIndex,
      type: 'fold',
      amount: 0,
      pot: gameState.pot,
    })

    const phase = engine.getPhase()

    if (phase === 'settle') {
      const settleResult = engine.settle()

      if (settleResult.showdown && settleResult.showdownResults) {
        this.broadcastToRoom(roomId, 'showdown', {
          results: settleResult.showdownResults.map(r => ({
            seatIndex: r.seatIndex,
            cards: r.cards,
            handRank: r.handRank as any,
            handName: r.handName,
          })),
        })
      }

      this.broadcastToRoom(roomId, 'settle', {
        winners: settleResult.winners,
        showCards: settleResult.showdown,
      })
    } else if (phase === 'showdown') {
      const settleResult = engine.settle()

      this.broadcastToRoom(roomId, 'showdown', {
        results: (settleResult.showdownResults ?? []).map(r => ({
          seatIndex: r.seatIndex,
          cards: r.cards,
          handRank: r.handRank as any,
          handName: r.handName,
        })),
      })

      this.broadcastToRoom(roomId, 'settle', {
        winners: settleResult.winners,
        showCards: true,
      })
    } else {
      const updatedState = engine.getState()
      if (updatedState.currentTurn >= 0) {
        this.broadcastToRoom(roomId, 'turn', {
          seatIndex: updatedState.currentTurn,
          deadline: updatedState.turnDeadline,
          minRaise: engine.getMinRaise(),
          currentBet: engine.getCurrentBet(),
        })
        this.startTurnTimer(roomId, updatedState.currentTurn, room.config.turnTime)
      }
    }
  }

  send<E extends ServerEventName>(ws: WebSocket, event: E, data: ServerEvents[E]): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data }))
    }
  }

  broadcastToRoom<E extends ServerEventName>(
    roomId: string,
    event: E,
    data: ServerEvents[E],
    excludePlayerId?: string,
  ): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room) return

    for (const [playerId] of room.players) {
      if (excludePlayerId && playerId === excludePlayerId) continue
      const playerWs = this.playerSockets.get(playerId)
      if (playerWs) {
        this.send(playerWs, event, data)
      }
    }
  }
}
