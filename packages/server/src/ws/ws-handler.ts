import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { RoomManager } from '../rooms/room-manager'
import type { UserRepository } from '../db/user-repository'
import { verifyToken } from '../auth/jwt'
import { AIPlayerManager } from '../ai/ai-player'
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
  private userRepo: UserRepository
  private aiManager = new AIPlayerManager()
  private actionHistory: Map<string, string[]> = new Map()

  constructor(roomManager: RoomManager, userRepo: UserRepository) {
    this.roomManager = roomManager
    this.userRepo = userRepo
    this.wss = new WebSocketServer({ noServer: true })
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      const token = url.searchParams.get('token')

      if (!token) {
        ws.close(4001, 'Missing token')
        return
      }
      const payload = verifyToken(token)
      if (!payload) {
        ws.close(4001, 'Invalid token')
        return
      }
      const playerId = payload.userId
      console.log(`[WS] connection: userId=${playerId}, username=${payload.username}`)

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

      ws.on('close', () => this.handleDisconnect(ws, conn))
      ws.on('error', () => this.handleDisconnect(ws, conn))
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
      case 'add-ai':
        this.onAddAI(ws, conn, data as ClientEvents['add-ai'])
        break
      case 'remove-ai':
        this.onRemoveAI(ws, conn, data as ClientEvents['remove-ai'])
        break
      case 'list-ai-personalities':
        this.send(ws, 'ai-personalities', { personalities: this.aiManager.getPersonalities() })
        break
      // rebuy removed — chips = balance
      default:
        this.send(ws, 'error', { message: `Unknown event: ${event}` })
    }
  }

  // --- Room Join ---
  private onJoinRoom(ws: WebSocket, conn: PlayerConnection, data: ClientEvents['join-room']): void {
    try {
      const { code, nickname, avatar } = data

      // Check balance before joining (non-host, non-reconnect)
      const roomRef = this.roomManager.getRoomByCode(code)
      if (!roomRef) {
        this.send(ws, 'error', { message: 'Room not found' })
        return
      }
      const room = this.roomManager.getRoom(roomRef.id)
      if (!room) {
        this.send(ws, 'error', { message: 'Room not found' })
        return
      }
      const isAlreadyInRoom = room.players.has(conn.playerId)

      // Check balance for new joins
      if (!isAlreadyInRoom && !this.aiManager.isAI(conn.playerId)) {
        const user = this.userRepo.findById(conn.playerId)
        if (user && user.chips_balance <= 0) {
          this.send(ws, 'error', { message: '余额不足，无法加入游戏' })
          return
        }
      }

      const { player, isReconnect } = this.roomManager.joinRoom(code, conn.playerId, nickname, avatar)

      // Always sync chips from DB for real users (covers both new join and host reconnect)
      if (!this.aiManager.isAI(conn.playerId)) {
        const user = this.userRepo.findById(conn.playerId)
        if (user && player.chips === 0) {
          player.chips = user.chips_balance
        }
      }
      conn.roomId = roomRef.id
      player.isConnected = true

      const state = this.roomManager.getRoomState(roomRef.id)!
      const engine = this.roomManager.getEngine(roomRef.id)

      let myCards: [import('@texas-holdem/shared').Card, import('@texas-holdem/shared').Card] | undefined
      let hands: { seatIndex: number; bet: number; totalBet: number; hasActed: boolean }[] = []
      if (engine) {
        myCards = engine.getPlayerCards(player.seatIndex) ?? undefined
        hands = engine.getPlayerHandStates()
      }

      this.send(ws, 'room-state', { room: state, hands, myCards })

      if (engine && state.game && state.game.currentTurn >= 0) {
        this.send(ws, 'turn', {
          seatIndex: state.game.currentTurn,
          deadline: state.game.turnDeadline,
          minRaise: engine.getMinRaise(),
          currentBet: engine.getCurrentBet(),
          hands: engine.getPlayerHandStates(),
        })
      }

      if (!isReconnect) {
        this.broadcastToRoom(roomRef.id, 'player-joined', { player }, conn.playerId)
      }
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to join room' })
    }
  }

  // --- AI Management ---
  private onAddAI(ws: WebSocket, conn: PlayerConnection, data: ClientEvents['add-ai']): void {
    if (!conn.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' })
      return
    }
    const room = this.roomManager.getRoom(conn.roomId)
    if (!room) return
    if (room.hostId !== conn.playerId) {
      this.send(ws, 'error', { message: '只有房主可以添加AI' })
      return
    }
    if (room.status !== 'waiting') {
      this.send(ws, 'error', { message: '游戏中无法添加AI' })
      return
    }

    // Find next available seat
    const usedSeats = new Set([...room.players.values()].map(p => p.seatIndex))
    let seatIndex = -1
    for (let i = 0; i < room.config.maxPlayers; i++) {
      if (!usedSeats.has(i)) { seatIndex = i; break }
    }
    if (seatIndex === -1) {
      this.send(ws, 'error', { message: '房间已满' })
      return
    }

    try {
      const playerInfo = this.aiManager.addAI(conn.roomId, data.personalityId, seatIndex)
      playerInfo.chips = 10000 // AI default balance

      // Add to room manager
      room.players.set(playerInfo.id, playerInfo)

      // Broadcast updated state
      const state = this.roomManager.getRoomState(conn.roomId)!
      this.broadcastToRoom(conn.roomId, 'room-state', { room: state, hands: [] })

      // Check auto-start conditions
      this.checkAutoStart(conn.roomId)
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message })
    }
  }

  private onRemoveAI(ws: WebSocket, conn: PlayerConnection, data: ClientEvents['remove-ai']): void {
    if (!conn.roomId) return
    const room = this.roomManager.getRoom(conn.roomId)
    if (!room || room.hostId !== conn.playerId) {
      this.send(ws, 'error', { message: '只有房主可以移除AI' })
      return
    }
    if (!this.aiManager.isAI(data.playerId)) {
      this.send(ws, 'error', { message: '该玩家不是AI' })
      return
    }

    const playerInfo = room.players.get(data.playerId)
    const seatIndex = playerInfo?.seatIndex ?? -1
    this.aiManager.removeAI(conn.roomId, data.playerId)
    room.players.delete(data.playerId)

    if (seatIndex >= 0) {
      this.broadcastToRoom(conn.roomId, 'player-left', { seatIndex })
    }
    const state = this.roomManager.getRoomState(conn.roomId)!
    this.broadcastToRoom(conn.roomId, 'room-state', { room: state, hands: [] })
  }

  // --- Ready & Start ---
  private onPlayerReady(ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' })
      return
    }
    try {
      this.roomManager.toggleReady(conn.roomId, conn.playerId)
      const state = this.roomManager.getRoomState(conn.roomId)!
      this.broadcastToRoom(conn.roomId, 'room-state', { room: state, hands: [] })
      this.checkAutoStart(conn.roomId)
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to toggle ready' })
    }
  }

  private checkAutoStart(roomId: string): void {
    const room = this.roomManager.getRoom(roomId)
    if (!room || room.status !== 'waiting') return
    const playersWithChips = [...room.players.values()].filter(p => p.chips > 0)
    if (playersWithChips.length >= 2 && playersWithChips.every(p => p.isReady)) {
      this.doStartGame(roomId, room.hostId)
    }
  }

  private onStartGame(ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' })
      return
    }
    try {
      this.doStartGame(conn.roomId, conn.playerId)
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to start game' })
    }
  }

  private doStartGame(roomId: string, requesterId: string): void {
    this.roomManager.startGame(roomId, requesterId)
    this.actionHistory.set(roomId, [])

    const room = this.roomManager.getRoom(roomId)!
    const engine = this.roomManager.getEngine(roomId)!
    const gameState = engine.getState()

    this.broadcastToRoom(roomId, 'game-start', {
      dealerSeat: gameState.dealerSeat,
      blinds: { small: room.config.blinds.small, big: room.config.blinds.big },
    })

    // Deal cards to all players (send to human via WS, store for AI)
    for (const player of room.players.values()) {
      const cards = engine.getPlayerCards(player.seatIndex)
      if (!cards) continue

      if (this.aiManager.isAI(player.id)) {
        this.aiManager.setHoleCards(player.id, cards)
      } else {
        const playerWs = this.playerSockets.get(player.id)
        if (playerWs) this.send(playerWs, 'deal-cards', { cards })
      }
    }

    if (gameState.currentTurn >= 0) {
      this.broadcastTurn(roomId, engine, room.config.turnTime)
      // Check if it's an AI's turn
      this.checkAITurn(roomId)
    }
  }

  // --- Actions ---
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
      const playerInfo = room.players.get(conn.playerId)
      if (!playerInfo) {
        this.send(ws, 'error', { message: 'Player not found in room' })
        return
      }

      this.processAction(conn.roomId, playerInfo.seatIndex, data.type, data.amount, playerInfo.nickname)
    } catch (err: any) {
      this.send(ws, 'error', { message: err.message ?? 'Failed to handle action' })
    }
  }

  /** Process a player action (human or AI) and handle phase transitions */
  private processAction(roomId: string, seatIndex: number, type: 'fold' | 'check' | 'call' | 'raise' | 'allIn', amount?: number, nickname?: string): void {
    const engine = this.roomManager.getEngine(roomId)
    if (!engine) return
    const room = this.roomManager.getRoom(roomId)
    if (!room) return

    this.clearTurnTimer(roomId)

    const prevPhase = engine.getPhase()
    const success = engine.handleAction(seatIndex, type, amount)
    if (!success) {
      console.error(`[Engine] Action rejected: seat=${seatIndex} type=${type} amount=${amount} currentTurn=${engine.getState().currentTurn} phase=${prevPhase}`)
      return
    }

    // Log action
    const history = this.actionHistory.get(roomId) ?? []
    const actionDesc = type === 'raise' ? `${nickname ?? 'Player'} raises ${amount}` :
      type === 'allIn' ? `${nickname ?? 'Player'} all-in` :
      `${nickname ?? 'Player'} ${type}s`
    history.push(actionDesc)
    if (history.length > 20) history.shift()

    const gameState = engine.getState()
    const playerState = engine.getPlayerState(seatIndex)

    this.broadcastToRoom(roomId, 'player-action', {
      seatIndex,
      type: type as any,
      amount: amount ?? 0,
      pot: gameState.pot,
      chips: playerState?.chips ?? 0,
    })

    const phase = engine.getPhase()

    if (phase === 'settle' || phase === 'showdown') {
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

      this.returnToWaiting(roomId, room, engine)
    } else {
      if (phase !== prevPhase) {
        this.broadcastToRoom(roomId, 'phase-change', {
          phase: gameState.phase,
          communityCards: gameState.communityCards,
        })
      }

      if (gameState.currentTurn >= 0) {
        this.broadcastTurn(roomId, engine, room.config.turnTime)
        // Check if next turn is AI
        this.checkAITurn(roomId)
      }
    }
  }

  /** Check if the current turn belongs to an AI player and trigger decision */
  private checkAITurn(roomId: string): void {
    const engine = this.roomManager.getEngine(roomId)
    if (!engine) return
    const room = this.roomManager.getRoom(roomId)
    if (!room) return

    const gameState = engine.getState()
    if (gameState.currentTurn < 0) return

    const currentPlayer = [...room.players.values()].find(p => p.seatIndex === gameState.currentTurn)
    if (!currentPlayer) {
      console.log(`[AI] No player found at seat ${gameState.currentTurn}`)
      return
    }
    if (!this.aiManager.isAI(currentPlayer.id)) return

    console.log(`[AI] It's ${currentPlayer.nickname}'s turn (seat ${gameState.currentTurn}), triggering AI decision...`)

    // Capture the expected seat so we can verify state hasn't changed after await
    const expectedSeat = gameState.currentTurn

    const executeAI = async () => {
      try {
        const history = this.actionHistory.get(roomId) ?? []
        const action = await this.aiManager.decide(currentPlayer.id, engine, room.players, history)

        // Verify the turn hasn't changed while we were thinking
        const currentState = engine.getState()
        if (currentState.currentTurn !== expectedSeat) {
          console.log(`[AI] ${currentPlayer.nickname} turn expired, skipping action`)
          return
        }

        console.log(`[AI] ${currentPlayer.nickname} decides: ${action.type}${action.amount ? ` ${action.amount}` : ''}`)
        this.processAction(roomId, currentPlayer.seatIndex, action.type, action.amount, currentPlayer.nickname)
      } catch (err) {
        console.error(`[AI] Decision error for ${currentPlayer.nickname}:`, err)
        // Verify state is still valid before fallback
        try {
          const currentState = engine.getState()
          if (currentState.currentTurn !== expectedSeat) return
          const callAmount = engine.getCurrentBet() - (engine.getPlayerHandStates().find(h => h.seatIndex === currentPlayer.seatIndex)?.bet ?? 0)
          this.processAction(roomId, currentPlayer.seatIndex, callAmount > 0 ? 'fold' : 'check', undefined, currentPlayer.nickname)
        } catch (innerErr) {
          console.error(`[AI] Fallback also failed for ${currentPlayer.nickname}:`, innerErr)
        }
      }
    }

    // Fire and forget — but errors are caught internally
    executeAI()
  }

  // --- Leave & Show Cards ---
  private onLeaveRoom(_ws: WebSocket, conn: PlayerConnection): void {
    if (!conn.roomId) return
    const roomId = conn.roomId
    const room = this.roomManager.getRoom(roomId)
    const playerInfo = room?.players.get(conn.playerId)
    const seatIndex = playerInfo?.seatIndex ?? -1

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
    this.broadcastToRoom(conn.roomId, 'cards-revealed', { seatIndex: playerInfo.seatIndex, cards })
  }

  // --- Disconnect ---
  private handleDisconnect(_ws: WebSocket, conn: PlayerConnection): void {
    const currentSocket = this.playerSockets.get(conn.playerId)
    const isStaleConnection = currentSocket && currentSocket !== _ws

    if (conn.roomId && !isStaleConnection) {
      const room = this.roomManager.getRoom(conn.roomId)
      if (room) {
        const playerInfo = room.players.get(conn.playerId)
        if (playerInfo) {
          if (room.status === 'waiting') {
            const seatIndex = playerInfo.seatIndex
            this.roomManager.leaveRoom(conn.roomId, conn.playerId)
            this.broadcastToRoom(conn.roomId, 'player-left', { seatIndex })
          } else {
            playerInfo.isConnected = false
          }
        }
      }
    }

    if (!isStaleConnection) {
      this.playerSockets.delete(conn.playerId)
    }
    this.connections.delete(_ws)
  }

  // --- Timers ---
  private startTurnTimer(roomId: string, seatIndex: number, turnTime: number): void {
    this.clearTurnTimer(roomId)
    const timer = setTimeout(() => this.autoFold(roomId, seatIndex), turnTime * 1000)
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
    if (!engine || engine.getState().currentTurn !== seatIndex) return
    const room = this.roomManager.getRoom(roomId)
    if (!room) return
    const player = [...room.players.values()].find(p => p.seatIndex === seatIndex)
    this.processAction(roomId, seatIndex, 'fold', undefined, player?.nickname)
  }

  // --- Helpers ---
  /** Check if a seat belongs to an AI player */
  private isAISeat(roomId: string, seatIndex: number): boolean {
    const room = this.roomManager.getRoom(roomId)
    if (!room) return false
    const player = [...room.players.values()].find(p => p.seatIndex === seatIndex)
    return !!player && this.aiManager.isAI(player.id)
  }

  private broadcastTurn(roomId: string, engine: any, turnTime: number): void {
    const gameState = engine.getState()
    this.broadcastToRoom(roomId, 'turn', {
      seatIndex: gameState.currentTurn,
      deadline: gameState.turnDeadline,
      minRaise: engine.getMinRaise(),
      currentBet: engine.getCurrentBet(),
      hands: engine.getPlayerHandStates(),
    })
    // Only start timer for human players — AI handles its own timing
    if (!this.isAISeat(roomId, gameState.currentTurn)) {
      this.startTurnTimer(roomId, gameState.currentTurn, turnTime)
    }
  }

  private returnToWaiting(roomId: string, room: any, engine: any): void {
    setTimeout(() => {
      const currentRoom = this.roomManager.getRoom(roomId)
      if (!currentRoom) return

      // Sync chips from engine and persist to DB
      for (const p of currentRoom.players.values()) {
        const ps = engine.getPlayerState(p.seatIndex)
        if (!ps) continue

        const prevChips = p.chips
        p.chips = ps.chips

        if (!this.aiManager.isAI(p.id)) {
          // Write current chips directly as the user's balance
          this.userRepo.updateChips(p.id, p.chips)
          this.userRepo.incrementGames(p.id)
          if (p.chips > prevChips) {
            this.userRepo.incrementWins(p.id)
          }
          console.log(`[Chips] ${p.nickname}: ${prevChips} → ${p.chips}`)
        }
      }

      currentRoom.status = 'waiting'

      // Kick broke players and AI
      const toKick: { id: string; seatIndex: number }[] = []
      for (const p of currentRoom.players.values()) {
        if (p.chips <= 0) {
          toKick.push({ id: p.id, seatIndex: p.seatIndex })
        } else {
          p.isReady = this.aiManager.isAI(p.id)
          p.status = 'sitting'
        }
      }
      for (const { id, seatIndex } of toKick) {
        if (this.aiManager.isAI(id)) {
          this.aiManager.removeAI(roomId, id)
        } else {
          // Notify the player they've been removed
          const playerWs = this.playerSockets.get(id)
          if (playerWs) {
            this.send(playerWs, 'error', { message: '筹码归零，已离开牌桌' })
          }
        }
        currentRoom.players.delete(id)
        this.broadcastToRoom(roomId, 'player-left', { seatIndex })
      }

      const state = this.roomManager.getRoomState(roomId)
      if (state) {
        this.broadcastToRoom(roomId, 'room-state', { room: state, hands: [] })
      }

      // Redirect kicked human players to lobby
      for (const { id } of toKick) {
        if (!this.aiManager.isAI(id)) {
          const playerWs = this.playerSockets.get(id)
          if (playerWs) {
            const conn = this.connections.get(playerWs)
            if (conn) conn.roomId = null
          }
        }
      }

      this.checkAutoStart(roomId)
    }, 3000)
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
      // Skip AI players — they don't have WS connections
      if (this.aiManager.isAI(playerId)) continue
      const playerWs = this.playerSockets.get(playerId)
      if (playerWs) this.send(playerWs, event, data)
    }
  }
}
