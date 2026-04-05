import { describe, it, expect } from 'vitest'
import { calculateSidePots } from '../engine/pot-calculator'
import type { BetInfo } from '../engine/pot-calculator'

describe('calculateSidePots', () => {
  it('single pot (no all-in): 3 players bet 200 each', () => {
    const bets: BetInfo[] = [
      { seatIndex: 0, totalBet: 200, isAllIn: false, isFolded: false },
      { seatIndex: 1, totalBet: 200, isAllIn: false, isFolded: false },
      { seatIndex: 2, totalBet: 200, isAllIn: false, isFolded: false },
    ]
    const result = calculateSidePots(bets)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(600)
    expect(result[0].eligible).toEqual([0, 1, 2])
  })

  it('side pot with one all-in: player 0 bets 100 all-in, others bet 200', () => {
    const bets: BetInfo[] = [
      { seatIndex: 0, totalBet: 100, isAllIn: true, isFolded: false },
      { seatIndex: 1, totalBet: 200, isAllIn: false, isFolded: false },
      { seatIndex: 2, totalBet: 200, isAllIn: false, isFolded: false },
    ]
    const result = calculateSidePots(bets)
    expect(result).toHaveLength(2)
    // Main pot: 100 * 3 = 300, all eligible
    expect(result[0].amount).toBe(300)
    expect(result[0].eligible).toEqual([0, 1, 2])
    // Side pot: 100 * 2 = 200, only players 1 and 2
    expect(result[1].amount).toBe(200)
    expect(result[1].eligible).toEqual([1, 2])
  })

  it('multiple all-ins at different levels: 50/150/300', () => {
    const bets: BetInfo[] = [
      { seatIndex: 0, totalBet: 50, isAllIn: true, isFolded: false },
      { seatIndex: 1, totalBet: 150, isAllIn: true, isFolded: false },
      { seatIndex: 2, totalBet: 300, isAllIn: false, isFolded: false },
    ]
    const result = calculateSidePots(bets)
    expect(result).toHaveLength(3)
    // Level 50: 50 * 3 = 150, all eligible
    expect(result[0].amount).toBe(150)
    expect(result[0].eligible).toEqual([0, 1, 2])
    // Level 150: (150 - 50) * 2 = 200, players 1 and 2
    expect(result[1].amount).toBe(200)
    expect(result[1].eligible).toEqual([1, 2])
    // Remaining: 300 - 150 = 150, only player 2
    expect(result[2].amount).toBe(150)
    expect(result[2].eligible).toEqual([2])
  })

  it('folded player excluded from eligibility', () => {
    const bets: BetInfo[] = [
      { seatIndex: 0, totalBet: 100, isAllIn: true, isFolded: false },
      { seatIndex: 1, totalBet: 200, isAllIn: false, isFolded: true },
      { seatIndex: 2, totalBet: 200, isAllIn: false, isFolded: false },
    ]
    const result = calculateSidePots(bets)
    // Main pot: 300 (100 * 3), eligible: [0, 2] (player 1 folded)
    expect(result[0].amount).toBe(300)
    expect(result[0].eligible).toEqual([0, 2])
    // Side pot: 200 (100 * 2), eligible: [2] only (player 1 folded)
    expect(result[1].amount).toBe(200)
    expect(result[1].eligible).toEqual([2])
  })
})
