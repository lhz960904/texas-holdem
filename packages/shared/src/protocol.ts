import type { ActionType, Card, GameState, PlayerHandState, PlayerInfo, RoomConfig, RoomState, HandRank } from './types'

export interface ClientEvents {
  'join-room': { code: string; nickname: string; avatar: string }
  'player-ready': {}
  'start-game': {}
  'action': { type: ActionType; amount?: number }
  'leave-room': {}
  'show-cards': {}
}

export interface ServerEvents {
  'room-state': { room: RoomState; hands: PlayerHandState[]; myCards?: [Card, Card] }
  'player-joined': { player: PlayerInfo }
  'player-left': { seatIndex: number }
  'game-start': { dealerSeat: number; blinds: { small: number; big: number } }
  'deal-cards': { cards: [Card, Card] }
  'phase-change': { phase: string; communityCards: Card[] }
  'turn': { seatIndex: number; deadline: number; minRaise: number; currentBet: number; hands?: PlayerHandState[] }
  'player-action': { seatIndex: number; type: ActionType; amount: number; pot: number; chips: number }
  'showdown': { results: ShowdownResult[] }
  'settle': { winners: SettleWinner[]; showCards: boolean }
  'cards-revealed': { seatIndex: number; cards: [Card, Card] }
  'error': { message: string }
}

export interface ShowdownResult { seatIndex: number; cards: [Card, Card]; handRank: HandRank; handName: string }
export interface SettleWinner { seatIndex: number; amount: number; potIndex: number }
export type ClientEventName = keyof ClientEvents
export type ServerEventName = keyof ServerEvents
export interface WSMessage<T extends ClientEventName | ServerEventName = any> {
  event: T
  data: T extends ClientEventName ? ClientEvents[T] : T extends ServerEventName ? ServerEvents[T] : never
}
