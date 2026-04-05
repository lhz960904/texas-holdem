import type { Card, HandResult, HandRank } from '@texas-holdem/shared'
import { RANK_VALUES } from '@texas-holdem/shared'

// Generate all C(n, k) combinations
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function evaluate5CardHand(cards: Card[]): HandResult {
  // Sort descending by rank value
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank])
  const values = sorted.map(c => RANK_VALUES[c.rank])

  const isFlush = cards.every(c => c.suit === cards[0].suit)

  // Check straight
  let isStraight = false
  let straightHigh = values[0]

  // Normal straight: consecutive values
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true
    straightHigh = values[0]
  }

  // Ace-low straight (wheel): A-2-3-4-5
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true
    straightHigh = 5
  }

  // Count rank frequencies
  const freq: Record<number, number> = {}
  for (const v of values) freq[v] = (freq[v] || 0) + 1

  const freqEntries = Object.entries(freq)
    .map(([v, cnt]) => ({ v: Number(v), cnt }))
    .sort((a, b) => b.cnt - a.cnt || b.v - a.v)

  const counts = freqEntries.map(e => e.cnt)
  const hasQuad = counts[0] === 4
  const hasTrip = counts[0] === 3
  const hasPair = counts[0] === 2 || counts[1] === 2
  const hasTwoPair = counts[0] === 2 && counts[1] === 2
  const hasFullHouse = counts[0] === 3 && counts[1] === 2

  let rank: HandRank
  let rankValue: number
  let kickers: number[]

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      rank = 'royal-flush'
      rankValue = 9
      kickers = [14]
    } else {
      rank = 'straight-flush'
      rankValue = 8
      kickers = [straightHigh]
    }
  } else if (hasQuad) {
    rank = 'four-of-a-kind'
    rankValue = 7
    const quadVal = freqEntries.find(e => e.cnt === 4)!.v
    const kicker = freqEntries.find(e => e.cnt !== 4)!.v
    kickers = [quadVal, kicker]
  } else if (hasFullHouse) {
    rank = 'full-house'
    rankValue = 6
    const tripVal = freqEntries.find(e => e.cnt === 3)!.v
    const pairVal = freqEntries.find(e => e.cnt === 2)!.v
    kickers = [tripVal, pairVal]
  } else if (isFlush) {
    rank = 'flush'
    rankValue = 5
    kickers = values
  } else if (isStraight) {
    rank = 'straight'
    rankValue = 4
    kickers = [straightHigh]
  } else if (hasTrip) {
    rank = 'three-of-a-kind'
    rankValue = 3
    const tripVal = freqEntries.find(e => e.cnt === 3)!.v
    const rest = freqEntries.filter(e => e.cnt !== 3).map(e => e.v).sort((a, b) => b - a)
    kickers = [tripVal, ...rest]
  } else if (hasTwoPair) {
    rank = 'two-pair'
    rankValue = 2
    const pairs = freqEntries.filter(e => e.cnt === 2).map(e => e.v).sort((a, b) => b - a)
    const kicker = freqEntries.find(e => e.cnt === 1)!.v
    kickers = [...pairs, kicker]
  } else if (hasPair) {
    rank = 'one-pair'
    rankValue = 1
    const pairVal = freqEntries.find(e => e.cnt === 2)!.v
    const rest = freqEntries.filter(e => e.cnt !== 2).map(e => e.v).sort((a, b) => b - a)
    kickers = [pairVal, ...rest]
  } else {
    rank = 'high-card'
    rankValue = 0
    kickers = values
  }

  return { rank, rankValue, bestCards: sorted, kickers }
}

export function evaluateHand(cards: Card[]): HandResult {
  const combos = combinations(cards, 5)
  let best: HandResult | null = null

  for (const combo of combos) {
    const result = evaluate5CardHand(combo)
    if (!best || compareResults(result, best) > 0) {
      best = result
    }
  }

  return best!
}

function compareResults(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const av = a.kickers[i] ?? 0
    const bv = b.kickers[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

export function compareHands(cardsA: Card[], cardsB: Card[]): number {
  const a = evaluateHand(cardsA)
  const b = evaluateHand(cardsB)
  return compareResults(a, b)
}
