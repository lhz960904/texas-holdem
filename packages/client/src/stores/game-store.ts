import { create } from 'zustand'
import type { Card, GamePhase, PlayerHandState, RoomState } from '@texas-holdem/shared'
import type { ShowdownResult, SettleWinner } from '@texas-holdem/shared'
import { WsClient } from '../lib/ws-client'

export type Screen = 'lobby' | 'room-setup' | 'waiting' | 'game'

interface GameState {
  // Connection
  wsClient: WsClient | null
  playerId: string | null
  connected: boolean

  // Room
  room: RoomState | null
  myCards: [Card, Card] | null
  hands: PlayerHandState[]

  // Game turn
  currentTurn: number | null
  turnDeadline: number | null
  minRaise: number
  currentBet: number

  // Settle
  showdownResults: ShowdownResult[]
  settleWinners: SettleWinner[]
  settleShowCards: boolean
  revealedCards: Map<number, [Card, Card]>

  // Screen
  screen: Screen
}

interface GameActions {
  setScreen: (screen: Screen) => void
  initConnection: (playerId: string) => void
  disconnect: () => void
  joinRoom: (code: string, nickname: string, avatar: string) => void
  tryReconnect: () => boolean
  toggleReady: () => void
  startGame: () => void
  sendAction: (type: string, amount?: number) => void
  showCards: () => void
  leaveRoom: () => void
  clearSettle: () => void
}

const STORAGE_KEY = 'texas-holdem-session'

interface SessionData {
  playerId: string
  roomCode: string
  nickname: string
  avatar: string
}

function saveSession(data: SessionData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

const initialState: GameState = {
  wsClient: null,
  playerId: null,
  connected: false,
  room: null,
  myCards: null,
  hands: [],
  currentTurn: null,
  turnDeadline: null,
  minRaise: 0,
  currentBet: 0,
  showdownResults: [],
  settleWinners: [],
  settleShowCards: false,
  revealedCards: new Map(),
  screen: 'lobby',
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  setScreen: (screen) => set({ screen }),

  initConnection: (playerId) => {
    const existing = get().wsClient
    if (existing) existing.disconnect()

    const wsClient = new WsClient(playerId)

    // Register all server event handlers
    wsClient.on('room-state', ({ room, hands, myCards }) => {
      // Determine screen based on room status
      const screen = room.status === 'playing' ? 'game' : 'waiting'
      set({ room, hands, myCards: myCards ?? null, screen })
    })

    wsClient.on('player-joined', ({ player }) => {
      set((state) => {
        if (!state.room) return {}
        return {
          room: {
            ...state.room,
            players: [...state.room.players, player],
          },
        }
      })
    })

    wsClient.on('player-left', ({ seatIndex }) => {
      set((state) => {
        if (!state.room) return {}
        return {
          room: {
            ...state.room,
            players: state.room.players.filter((p) => p.seatIndex !== seatIndex),
          },
        }
      })
    })

    wsClient.on('game-start', () => {
      set({
        screen: 'game',
        showdownResults: [],
        settleWinners: [],
        settleShowCards: false,
        revealedCards: new Map(),
      })
    })

    wsClient.on('deal-cards', ({ cards }) => {
      set({ myCards: cards })
    })

    wsClient.on('phase-change', ({ phase, communityCards }) => {
      set((state) => {
        if (!state.room?.game) return {}
        return {
          room: {
            ...state.room,
            game: {
              ...state.room.game,
              phase: phase as GamePhase,
              communityCards,
            },
          },
        }
      })
    })

    wsClient.on('turn', ({ seatIndex, deadline, minRaise, currentBet }) => {
      set({
        currentTurn: seatIndex,
        turnDeadline: deadline,
        minRaise,
        currentBet,
      })
    })

    wsClient.on('player-action', ({ pot }) => {
      set((state) => {
        if (!state.room?.game) return {}
        return {
          room: {
            ...state.room,
            game: {
              ...state.room.game,
              pot,
            },
          },
        }
      })
    })

    wsClient.on('showdown', ({ results }) => {
      set({ showdownResults: results })
    })

    wsClient.on('settle', ({ winners, showCards }) => {
      set({ settleWinners: winners, settleShowCards: showCards })
    })

    wsClient.on('cards-revealed', ({ seatIndex, cards }) => {
      set((state) => {
        const revealedCards = new Map(state.revealedCards)
        revealedCards.set(seatIndex, cards)
        return { revealedCards }
      })
    })

    wsClient.on('error', ({ message }) => {
      console.error('[WS Error]', message)
      // If room not found during reconnect, clear session and go to lobby
      if (message.includes('not found') || message.includes('Not found')) {
        clearSession()
        set({ room: null, screen: 'lobby' })
      }
    })

    wsClient.connect()
    set({ wsClient, playerId, connected: true })
  },

  disconnect: () => {
    get().wsClient?.disconnect()
    set({ wsClient: null, connected: false })
  },

  joinRoom: (code, nickname, avatar) => {
    const playerId = get().playerId
    if (playerId) {
      saveSession({ playerId, roomCode: code, nickname, avatar })
    }
    get().wsClient?.send('join-room', { code, nickname, avatar })
    set({ screen: 'waiting' })
  },

  tryReconnect: () => {
    const session = loadSession()
    if (!session) return false
    const { playerId, roomCode, nickname, avatar } = session
    get().initConnection(playerId)
    // Wait for WS to connect, then rejoin room
    setTimeout(() => {
      useGameStore.getState().wsClient?.send('join-room', {
        code: roomCode,
        nickname,
        avatar,
      })
    }, 500)
    set({ playerId })
    return true
  },

  toggleReady: () => {
    get().wsClient?.send('player-ready', {})
  },

  startGame: () => {
    get().wsClient?.send('start-game', {})
  },

  sendAction: (type, amount) => {
    get().wsClient?.send('action', { type: type as any, amount })
  },

  showCards: () => {
    get().wsClient?.send('show-cards', {})
  },

  leaveRoom: () => {
    get().wsClient?.send('leave-room', {})
    clearSession()
    set({
      room: null,
      myCards: null,
      hands: [],
      currentTurn: null,
      turnDeadline: null,
      minRaise: 0,
      currentBet: 0,
      showdownResults: [],
      settleWinners: [],
      settleShowCards: false,
      revealedCards: new Map(),
      screen: 'lobby',
    })
  },

  clearSettle: () => {
    set({
      showdownResults: [],
      settleWinners: [],
      settleShowCards: false,
    })
  },
}))
