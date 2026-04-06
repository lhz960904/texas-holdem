import { create } from 'zustand'
import type { Card, GamePhase, PlayerHandState, RoomState } from '@texas-holdem/shared'
import type { ShowdownResult, SettleWinner } from '@texas-holdem/shared'
import { WsClient } from '../lib/ws-client'
import { sounds } from '../lib/sounds'

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

  // Animations
  lastAction: { seatIndex: number; type: string } | null
  potCollectTarget: number | null // seat index of winner for chip fly animation

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
  clearAnimations: () => void
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
  lastAction: null,
  potCollectTarget: null,
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
      const currentScreen = get().screen
      // If we were in game and room goes back to waiting (settle), stay on game screen
      // so the table shows ready controls instead of jumping to waiting room
      let screen: Screen
      if (room.status === 'playing') {
        screen = 'game'
      } else if (currentScreen === 'game') {
        // Post-settle: stay on game screen to show ready button
        screen = 'game'
      } else {
        screen = 'waiting'
      }
      set({ room, hands, myCards: myCards ?? null, screen })
    })

    wsClient.on('player-joined', ({ player }) => {
      set((state) => {
        if (!state.room) return {}
        // Prevent duplicates — filter out any existing player with same seatIndex or id
        const filtered = state.room.players.filter(
          (p) => p.seatIndex !== player.seatIndex && p.id !== player.id
        )
        return {
          room: {
            ...state.room,
            players: [...filtered, player],
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

    wsClient.on('game-start', ({ dealerSeat, blinds }) => {
      set((state) => {
        if (!state.room) return {}
        const players = state.room.players
        const seats = players.map((p) => p.seatIndex).sort((a, b) => a - b)
        // For 2 players: dealer=seat[0], SB=next, BB=next
        // For 3+: dealer=dealerSeat, SB=next, BB=next
        const dealerIdx = seats.indexOf(dealerSeat)
        const sbIdx = (dealerIdx + 1) % seats.length
        const bbIdx = (dealerIdx + (seats.length === 2 ? 1 : 2)) % seats.length
        const sbSeat = seats[sbIdx]
        const bbSeat = seats.length === 2 ? seats[dealerIdx] : seats[bbIdx]

        // Initialize hands with blind bets
        const initHands = players.map((p) => ({
          seatIndex: p.seatIndex,
          bet: p.seatIndex === sbSeat ? blinds.small : p.seatIndex === bbSeat ? blinds.big : 0,
          totalBet: p.seatIndex === sbSeat ? blinds.small : p.seatIndex === bbSeat ? blinds.big : 0,
          hasActed: false,
        }))

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
        // Reset all bets to 0 on phase change (collectBets was called)
        const resetHands = state.hands.map((h) => ({ ...h, bet: 0 }))
        return {
          hands: resetHands,
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

    wsClient.on('turn', ({ seatIndex, deadline, minRaise, currentBet, hands: turnHands }) => {
      // Play turn alert if it's my turn
      const mySeat = get().room?.players.find((p) => p.id === get().playerId)?.seatIndex
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
        // Update hands if provided by server
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

    wsClient.on('player-action', ({ seatIndex, type, pot }) => {
      if (type === 'fold') {
        sounds.play('fold')
      } else if (type === 'check') {
        sounds.play('check')
      } else {
        // call, raise, allIn
        sounds.play('chips')
      }
      set((state) => {
        if (!state.room?.game) return {}
        return {
          lastAction: { seatIndex, type },
          room: {
            ...state.room,
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
      // Only clear session if room truly doesn't exist
      if (message === 'Room not found') {
        clearSession()
        // Only go to lobby if we don't already have a room loaded
        if (!get().room) {
          set({ screen: 'lobby' })
        }
      }
    })

    sounds.preload()
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
    // Messages are queued until WS connects
    get().wsClient?.send('join-room', { code: roomCode, nickname, avatar })
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
      potCollectTarget: null,
    })
  },

  clearAnimations: () => {
    set({ lastAction: null, potCollectTarget: null })
  },
}))
