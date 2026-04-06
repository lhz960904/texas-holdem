import { evalHand, winningOddsForPlayer } from 'poker-evaluator'
import type { Card, Suit, Rank } from '@texas-holdem/shared'

/** Convert our Card type to poker-evaluator format (e.g., "As", "Td", "2c") */
function toPokerEvalCard(card: Card): string {
  const rankMap: Record<Rank, string> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
    '9': '9', '10': 'T', J: 'J', Q: 'Q', K: 'K', A: 'A',
  }
  const suitMap: Record<Suit, string> = {
    hearts: 'h', diamonds: 'd', clubs: 'c', spades: 's',
  }
  return rankMap[card.rank] + suitMap[card.suit]
}

export interface HandStrength {
  handType: number
  handName: string
  rank: number
}

export interface EquityResult {
  winRate: number
  tieRate: number
}

/** Evaluate a hand (5-7 cards) */
export function evaluateHand(cards: Card[]): HandStrength {
  const peCards = cards.map(toPokerEvalCard)
  const result = evalHand(peCards)
  return {
    handType: result.handType,
    handName: result.handName,
    rank: result.value,
  }
}

/** Calculate equity for hole cards given community cards and opponent count */
export function calculateEquity(
  holeCards: [Card, Card],
  communityCards: Card[],
  numOpponents: number
): EquityResult {
  const peHole = holeCards.map(toPokerEvalCard)
  const peCommunity = communityCards.map(toPokerEvalCard)

  try {
    // poker-evaluator API: winningOddsForPlayer(playerCards, communityCards, numOpponents, numSimulations)
    const result = winningOddsForPlayer(peHole, peCommunity, numOpponents, 1000) as any
    const winRate = result.winRate ?? 0.5
    const tieRate = result.splitRates
      ? result.splitRates.reduce((s: number, r: any) => s + (r.rate ?? 0), 0)
      : 0
    return { winRate, tieRate }
  } catch {
    // Fallback: rough estimation based on hand strength
    const allCards = [...peHole, ...peCommunity]
    if (allCards.length >= 5) {
      const hand = evalHand(allCards)
      return { winRate: hand.value / 36874, tieRate: 0.02 }
    }
    return { winRate: 0.5, tieRate: 0.02 }
  }
}

/** Calculate pot odds */
export function calculatePotOdds(callAmount: number, potSize: number): number {
  if (callAmount <= 0) return 0
  return callAmount / (potSize + callAmount)
}
