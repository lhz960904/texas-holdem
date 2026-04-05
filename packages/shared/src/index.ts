// @texas-holdem/shared — types and utilities shared between server and client

// Card suits and ranks
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  suit: Suit
  rank: Rank
}

// Player states
export type PlayerStatus = 'waiting' | 'active' | 'folded' | 'all-in' | 'out'

export interface Player {
  id: string
  name: string
  chips: number
  status: PlayerStatus
  holeCards?: [Card, Card]
}

// Game phases
export type GamePhase = 'waiting' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown'

export interface GameState {
  id: string
  phase: GamePhase
  players: Player[]
  communityCards: Card[]
  pot: number
  currentBet: number
  activePlayerId?: string
}

// WebSocket message types
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'leave' }
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'all-in' }

export type ServerMessage =
  | { type: 'game-state'; state: GameState }
  | { type: 'player-joined'; player: Player }
  | { type: 'player-left'; playerId: string }
  | { type: 'error'; message: string }
