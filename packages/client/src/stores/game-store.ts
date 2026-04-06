import { create } from 'zustand'
import type { Card, GamePhase, PlayerHandState, RoomState } from '@texas-holdem/shared'
import type { ShowdownResult, SettleWinner } from '@texas-holdem/shared'
import { WsClient } from '../lib/ws-client'
import { sounds } from '../lib/sounds'

export type Screen = 'login' | 'lobby' | 'room-setup' | 'waiting' | 'game'

export interface AuthUser {
  id: string
  username: string
  nickname: string
  avatar: string
  chips_balance: number
  games_played: number
  games_won: number
}

interface GameState {
  // Auth
  token: string | null
  user: AuthUser | null

  // Connection
  wsClient: WsClient | null
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

  // Animations
  lastAction: { seatIndex: number; type: string } | null
  potCollectTarget: number | null

  // Screen
  screen: Screen
}

interface GameActions {
  setScreen: (screen: Screen) => void
  login: (username: string, password: string, avatar: string) => Promise<{ error?: string; isNewUser?: boolean }>
  logout: () => void
  initConnection: () => void
  disconnect: () => void
  createRoom: (config: any) => Promise<{ code?: string; error?: string }>
  joinRoom: (code: string) => void
  tryReconnect: () => boolean
  toggleReady: () => void
  startGame: () => void
  sendAction: (type: string, amount?: number) => void
  showCards: () => void
  leaveRoom: () => void
  clearSettle: () => void
  clearAnimations: () => void
  updateAvatar: (avatar: string) => Promise<void>
}

const TOKEN_KEY = 'texas-holdem-token'
const ROOM_KEY = 'texas-holdem-room'

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function saveRoomCode(code: string) {
  localStorage.setItem(ROOM_KEY, code)
}
function loadRoomCode(): string | null {
  return localStorage.getItem(ROOM_KEY)
}
function clearRoomCode() {
  localStorage.removeItem(ROOM_KEY)
}

const initialState: GameState = {
  token: null,
  user: null,
  wsClient: null,
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
  lastAction: null,
  potCollectTarget: null,
  screen: 'login',
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  setScreen: (screen) => set({ screen }),

  login: async (username, password, avatar) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, avatar }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error }

      saveToken(data.token)
      set({ token: data.token, user: data.user, screen: 'lobby' })

      // Auto-connect WS after login
      get().initConnection()

      return { isNewUser: data.isNewUser }
    } catch {
      return { error: '网络错误' }
    }
  },

  logout: () => {
    get().wsClient?.disconnect()
    clearToken()
    clearRoomCode()
    set({ ...initialState })
  },

  initConnection: () => {
    const token = get().token
    const user = get().user
    if (!token || !user) return

    const existing = get().wsClient
    if (existing) existing.disconnect()

    const wsClient = new WsClient(user.id, token)

    // Register all server event handlers
    wsClient.on('room-state', ({ room, hands, myCards }) => {
      const currentScreen = get().screen
      let screen: Screen
      if (room.status === 'playing') {
        screen = 'game'
      } else if (currentScreen === 'game') {
        screen = 'game'
      } else {
        screen = 'waiting'
      }
      // Save room code for reconnection
      saveRoomCode(room.code)
      set({ room, hands, myCards: myCards ?? null, screen })
    })

    wsClient.on('player-joined', ({ player }) => {
      set((state) => {
        if (!state.room) return {}
        const filtered = state.room.players.filter(
          (p) => p.seatIndex !== player.seatIndex && p.id !== player.id
        )
        return {
          room: { ...state.room, players: [...filtered, player] },
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

    wsClient.on('game-start', ({ dealerSeat, blinds }) => {
      set((state) => {
        if (!state.room) return {}
        const players = state.room.players
        const seats = players.map((p) => p.seatIndex).sort((a, b) => a - b)
        const dealerIdx = seats.indexOf(dealerSeat)
        const sbIdx = (dealerIdx + 1) % seats.length
        const bbIdx = (dealerIdx + (seats.length === 2 ? 1 : 2)) % seats.length
        const sbSeat = seats[sbIdx]
        const bbSeat = seats.length === 2 ? seats[dealerIdx] : seats[bbIdx]

        const initHands = players.map((p) => ({
          seatIndex: p.seatIndex,
          bet: p.seatIndex === sbSeat ? blinds.small : p.seatIndex === bbSeat ? blinds.big : 0,
          totalBet: p.seatIndex === sbSeat ? blinds.small : p.seatIndex === bbSeat ? blinds.big : 0,
          hasActed: false,
        }))

        const updatedPlayers = players.map((p) => {
          if (p.seatIndex === sbSeat) return { ...p, chips: p.chips - blinds.small }
          if (p.seatIndex === bbSeat) return { ...p, chips: p.chips - blinds.big }
          return p
        })

        return {
          screen: 'game' as Screen,
          myCards: null,
          hands: initHands,
          currentTurn: -1,
          turnDeadline: null,
          showdownResults: [],
          settleWinners: [],
          settleShowCards: false,
          lastAction: null,
          potCollectTarget: null,
          revealedCards: new Map(),
          room: {
            ...state.room,
            players: updatedPlayers,
            status: 'playing' as const,
            game: {
              id: '',
              phase: 'preflop' as GamePhase,
              dealerSeat,
              pot: blinds.small + blinds.big,
              communityCards: [],
              currentTurn: -1,
              turnDeadline: 0,
              sidePots: [],
            },
          },
        }
      })
    })

    wsClient.on('deal-cards', ({ cards }) => {
      sounds.play('deal')
      set({ myCards: cards })
    })

    wsClient.on('phase-change', ({ phase, communityCards }) => {
      sounds.play('flip')
      set((state) => {
        if (!state.room?.game) return {}
        const resetHands = state.hands.map((h) => ({ ...h, bet: 0 }))
        return {
          hands: resetHands,
          room: {
            ...state.room,
            game: { ...state.room.game, phase: phase as GamePhase, communityCards },
          },
        }
      })
    })

    wsClient.on('turn', ({ seatIndex, deadline, minRaise, currentBet, hands: turnHands }) => {
      const mySeat = get().room?.players.find((p) => p.id === get().user?.id)?.seatIndex
      if (mySeat !== undefined && seatIndex === mySeat) {
        sounds.play('turnAlert')
      }
      set((state) => {
        const updates: any = {
          currentTurn: seatIndex,
          turnDeadline: deadline,
          minRaise,
          currentBet,
        }
        if (turnHands) {
          updates.hands = turnHands
        }
        if (state.room?.game) {
          updates.room = {
            ...state.room,
            game: { ...state.room.game, currentTurn: seatIndex, turnDeadline: deadline },
          }
        }
        return updates
      })
    })

    wsClient.on('player-action', ({ seatIndex, type, pot, chips }) => {
      if (type === 'fold') sounds.play('fold')
      else if (type === 'check') sounds.play('check')
      else sounds.play('chips')

      set((state) => {
        if (!state.room?.game) return {}
        const updatedPlayers = state.room.players.map((p) => {
          if (p.seatIndex !== seatIndex) return p
          return {
            ...p,
            chips,
            // Mark player as folded when they fold
            status: type === 'fold' ? 'folded' as const : p.status,
          }
        })
        return {
          lastAction: { seatIndex, type },
          room: {
            ...state.room,
            players: updatedPlayers,
            game: { ...state.room.game, pot },
          },
        }
      })
    })

    wsClient.on('showdown', ({ results }) => {
      set({ showdownResults: results })
    })

    wsClient.on('settle', ({ winners, showCards }) => {
      sounds.play('win')
      const winnerSeat = winners.length > 0 ? winners[0].seatIndex : null
      set({ settleWinners: winners, settleShowCards: showCards, potCollectTarget: winnerSeat })
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
      if (message === 'Room not found') {
        clearRoomCode()
        if (!get().room) {
          set({ screen: 'lobby' })
        }
      }
      if (message === '筹码归零，已离开牌桌' || message === '余额不足，无法加入游戏') {
        clearRoomCode()
        set({ room: null, screen: 'lobby' })
        // Refresh user balance
        const token = get().token
        if (token) {
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(({ user }) => { if (user) set({ user }) })
            .catch(() => {})
        }
      }
    })

    sounds.preload()
    wsClient.connect()
    set({ wsClient, connected: true })
  },

  disconnect: () => {
    get().wsClient?.disconnect()
    set({ wsClient: null, connected: false })
  },

  createRoom: async (config) => {
    const token = get().token
    if (!token) return { error: 'Not authenticated' }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error }

      // Join the room via WS
      const user = get().user!
      get().wsClient?.send('join-room', { code: data.code, nickname: user.nickname, avatar: user.avatar })
      saveRoomCode(data.code)
      set({ room: null, screen: 'waiting' })
      return { code: data.code }
    } catch {
      return { error: '网络错误' }
    }
  },

  joinRoom: (code) => {
    const user = get().user
    if (!user) return
    get().wsClient?.send('join-room', { code, nickname: user.nickname, avatar: user.avatar })
    saveRoomCode(code)
    set({ room: null, screen: 'waiting' })
  },

  tryReconnect: () => {
    const token = loadToken()
    if (!token) return false

    // Validate token and fetch user
    fetch('/api/auth/me', { headers: authHeaders(token) })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid token')
        return res.json()
      })
      .then(({ user }) => {
        set({ token, user, screen: 'lobby' })
        // Connect WS
        get().initConnection()

        // If we have a saved room code, try to rejoin
        const roomCode = loadRoomCode()
        if (roomCode) {
          get().wsClient?.send('join-room', {
            code: roomCode,
            nickname: user.nickname,
            avatar: user.avatar,
          })
        }
      })
      .catch(() => {
        clearToken()
        clearRoomCode()
      })

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
    clearRoomCode()
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
    // Refresh user balance from server
    const token = get().token
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(({ user }) => { if (user) set({ user }) })
        .catch(() => {})
    }
  },

  clearSettle: () => {
    set({
      showdownResults: [],
      settleWinners: [],
      settleShowCards: false,
      potCollectTarget: null,
    })
  },

  clearAnimations: () => {
    set({ lastAction: null, potCollectTarget: null })
  },

  updateAvatar: async (avatar: string) => {
    const token = get().token
    if (!token) return
    await fetch('/api/auth/avatar', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ avatar }),
    })
    set((state) => ({
      user: state.user ? { ...state.user, avatar } : null,
    }))
  },
}))
