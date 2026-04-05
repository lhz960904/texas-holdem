import type { SidePot } from '@texas-holdem/shared'

export interface BetInfo {
  seatIndex: number
  totalBet: number
  isAllIn: boolean
  isFolded: boolean
}

export function calculateSidePots(bets: BetInfo[]): SidePot[] {
  // If no all-ins, return single pot
  const allInBets = bets.filter(b => b.isAllIn && !b.isFolded)
  if (allInBets.length === 0) {
    const total = bets.reduce((sum, b) => sum + b.totalBet, 0)
    const eligible = bets.filter(b => !b.isFolded).map(b => b.seatIndex)
    return [{ amount: total, eligible }]
  }

  // Get sorted unique all-in levels
  const allInLevels = [...new Set(allInBets.map(b => b.totalBet))].sort((a, b) => a - b)

  const sidePots: SidePot[] = []
  let prevLevel = 0

  for (const level of allInLevels) {
    const contribution = level - prevLevel
    // Each player contributes min(their totalBet, level) - prevLevel
    let amount = 0
    const eligible: number[] = []

    for (const bet of bets) {
      const contributed = Math.min(bet.totalBet, level) - Math.min(bet.totalBet, prevLevel)
      amount += contributed
      // Eligible: non-folded players who have bet at least this level
      if (!bet.isFolded && bet.totalBet >= level) {
        eligible.push(bet.seatIndex)
      }
    }

    if (amount > 0) {
      sidePots.push({ amount, eligible })
    }
    prevLevel = level
  }

  // Remaining bets above all all-in levels
  const maxAllIn = allInLevels[allInLevels.length - 1]
  let remaining = 0
  const remainingEligible: number[] = []

  for (const bet of bets) {
    if (bet.totalBet > maxAllIn) {
      remaining += bet.totalBet - maxAllIn
      if (!bet.isFolded) {
        remainingEligible.push(bet.seatIndex)
      }
    }
  }

  if (remaining > 0) {
    sidePots.push({ amount: remaining, eligible: remainingEligible })
  }

  return sidePots
}
