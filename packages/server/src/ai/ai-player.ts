import { randomUUID } from 'crypto'
import type { Card, PlayerInfo } from '@texas-holdem/shared'
import type { AIPersonality } from './personalities'
import { AI_PERSONALITIES, getPersonality } from './personalities'
import { makeDecision, type AIAction, type GameContext } from './ai-decision'
import type { GameEngine } from '../engine/game-engine'

export interface AIPlayer {
  id: string
  personalityId: string
  personality: AIPersonality
  seatIndex: number
  holeCards: [Card, Card] | null
}

export class AIPlayerManager {
  private aiPlayers: Map<string, AIPlayer> = new Map()
  private roomAIs: Map<string, Set<string>> = new Map()

  addAI(roomId: string, personalityId: string, seatIndex: number): PlayerInfo {
    const personality = getPersonality(personalityId)
    if (!personality) throw new Error(`Unknown AI personality: ${personalityId}`)

    const id = `ai-${randomUUID()}`
    const aiPlayer: AIPlayer = {
      id,
      personalityId,
      personality,
      seatIndex,
      holeCards: null,
    }

    this.aiPlayers.set(id, aiPlayer)
    if (!this.roomAIs.has(roomId)) {
      this.roomAIs.set(roomId, new Set())
    }
    this.roomAIs.get(roomId)!.add(id)

    return {
      id,
      nickname: personality.name,
      avatar: personality.avatar,
      seatIndex,
      chips: 0,
      status: 'sitting',
      isReady: true,
      isConnected: true,
      isAI: true,
    }
  }

  removeAI(roomId: string, playerId: string): void {
    this.aiPlayers.delete(playerId)
    this.roomAIs.get(roomId)?.delete(playerId)
  }

  removeAllFromRoom(roomId: string): void {
    const aiIds = this.roomAIs.get(roomId)
    if (aiIds) {
      for (const id of aiIds) this.aiPlayers.delete(id)
      this.roomAIs.delete(roomId)
    }
  }

  isAI(playerId: string): boolean {
    return this.aiPlayers.has(playerId)
  }

  getAI(playerId: string): AIPlayer | undefined {
    return this.aiPlayers.get(playerId)
  }

  getRoomAIs(roomId: string): string[] {
    return [...(this.roomAIs.get(roomId) ?? [])]
  }

  setHoleCards(playerId: string, cards: [Card, Card]): void {
    const ai = this.aiPlayers.get(playerId)
    if (ai) ai.holeCards = cards
  }

  /** Have an AI make a decision using the engine's public API */
  async decide(
    playerId: string,
    engine: GameEngine,
    roomPlayers: Map<string, PlayerInfo>,
    actionHistory: string[]
  ): Promise<AIAction> {
    const ai = this.aiPlayers.get(playerId)
    if (!ai) {
      console.error(`[AI] Player ${playerId} not found in aiPlayers map`)
      return { type: 'fold' }
    }
    if (!ai.holeCards) {
      console.error(`[AI] ${ai.personality.name} has no hole cards`)
      return { type: 'fold' }
    }

    const gameState = engine.getState()
    const playerState = engine.getPlayerState(ai.seatIndex)
    if (!playerState) {
      console.error(`[AI] ${ai.personality.name} not found in engine at seat ${ai.seatIndex}`)
      return { type: 'fold' }
    }

    const hand = engine.getPlayerHandStates().find((h) => h.seatIndex === ai.seatIndex)
    if (!hand) {
      console.error(`[AI] ${ai.personality.name} hand state not found`)
      return { type: 'fold' }
    }

    // Count active opponents (non-folded, non-self)
    const allHands = engine.getPlayerHandStates()
    const numOpponents = allHands.filter((h) => h.seatIndex !== ai.seatIndex).length

    const context: GameContext = {
      holeCards: ai.holeCards,
      communityCards: gameState.communityCards,
      pot: gameState.pot,
      currentBet: engine.getCurrentBet(),
      myBet: hand.bet,
      myChips: playerState.chips,
      minRaise: engine.getMinRaise(),
      numOpponents: Math.max(1, numOpponents),
      phase: gameState.phase,
      position: getPosition(ai.seatIndex, gameState.dealerSeat, allHands.length),
      actionHistory,
    }

    // Think time: 0.5-2s
    const thinkTime = 500 + Math.random() * 1500
    await new Promise((r) => setTimeout(r, thinkTime))

    return makeDecision(ai.personality, context)
  }

  getPersonalities(): { id: string; name: string; avatar: string; description: string }[] {
    return AI_PERSONALITIES.map(({ id, name, avatar, description }) => ({ id, name, avatar, description }))
  }
}

function getPosition(seatIndex: number, dealerSeat: number, numPlayers: number): string {
  const distance = (seatIndex - dealerSeat + numPlayers) % numPlayers
  if (distance === 0) return 'button'
  if (distance === 1) return 'small blind'
  if (distance === 2) return 'big blind'
  if (distance <= numPlayers / 3) return 'early'
  if (distance <= (numPlayers * 2) / 3) return 'middle'
  return 'late'
}
