export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
export type Rank = (typeof RANKS)[number]

export interface Card { suit: Suit; rank: Rank }

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export type PlayerStatus = 'active' | 'folded' | 'allIn' | 'sitting'
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'settle'
export type RoomStatus = 'waiting' | 'playing'
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allIn'

export interface Blinds { small: number; big: number }
export interface RoomConfig { blinds: Blinds; maxPlayers: number; turnTime: number }

export interface PlayerInfo {
  id: string; nickname: string; avatar: string; seatIndex: number;
  chips: number; status: PlayerStatus; isReady: boolean; isConnected: boolean;
  isAI?: boolean;
}

export interface RoomState {
  id: string; code: string; hostId: string; status: RoomStatus;
  config: RoomConfig; players: PlayerInfo[]; game: GameState | null;
}

export interface GameState {
  id: string; phase: GamePhase; dealerSeat: number; pot: number;
  communityCards: Card[]; currentTurn: number; turnDeadline: number; sidePots: SidePot[];
}

export interface SidePot { amount: number; eligible: number[] }

export interface PlayerHandState {
  seatIndex: number; bet: number; totalBet: number; hasActed: boolean;
  cards?: [Card, Card];
}

export const HAND_RANKS = [
  'high-card', 'one-pair', 'two-pair', 'three-of-a-kind', 'straight',
  'flush', 'full-house', 'four-of-a-kind', 'straight-flush', 'royal-flush',
] as const
export type HandRank = (typeof HAND_RANKS)[number]

export interface HandResult { rank: HandRank; rankValue: number; bestCards: Card[]; kickers: number[] }
