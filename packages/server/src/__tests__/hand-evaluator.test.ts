import { describe, it, expect } from 'vitest'
import { evaluateHand, compareHands } from '../engine/hand-evaluator'
import type { Card } from '@texas-holdem/shared'

const c = (rank: string, suit: string): Card => ({ rank, suit } as Card)

describe('evaluateHand', () => {
  it('detects royal flush', () => {
    const cards = [c('10','hearts'),c('J','hearts'),c('Q','hearts'),c('K','hearts'),c('A','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('royal-flush')
  })
  it('detects straight flush', () => {
    const cards = [c('5','spades'),c('6','spades'),c('7','spades'),c('8','spades'),c('9','spades'),c('2','hearts'),c('K','diamonds')]
    expect(evaluateHand(cards).rank).toBe('straight-flush')
  })
  it('detects four of a kind', () => {
    const cards = [c('K','hearts'),c('K','diamonds'),c('K','clubs'),c('K','spades'),c('A','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('four-of-a-kind')
  })
  it('detects full house', () => {
    const cards = [c('J','hearts'),c('J','diamonds'),c('J','clubs'),c('9','spades'),c('9','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('full-house')
  })
  it('detects flush', () => {
    const cards = [c('2','hearts'),c('5','hearts'),c('7','hearts'),c('9','hearts'),c('J','hearts'),c('K','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('flush')
  })
  it('detects straight', () => {
    const cards = [c('4','hearts'),c('5','diamonds'),c('6','clubs'),c('7','spades'),c('8','hearts'),c('K','clubs'),c('2','diamonds')]
    expect(evaluateHand(cards).rank).toBe('straight')
  })
  it('detects ace-low straight (wheel)', () => {
    const cards = [c('A','hearts'),c('2','diamonds'),c('3','clubs'),c('4','spades'),c('5','hearts'),c('K','clubs'),c('9','diamonds')]
    expect(evaluateHand(cards).rank).toBe('straight')
  })
  it('detects three of a kind', () => {
    const cards = [c('7','hearts'),c('7','diamonds'),c('7','clubs'),c('K','spades'),c('2','hearts'),c('9','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('three-of-a-kind')
  })
  it('detects two pair', () => {
    const cards = [c('J','hearts'),c('J','diamonds'),c('5','clubs'),c('5','spades'),c('A','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('two-pair')
  })
  it('detects one pair', () => {
    const cards = [c('A','hearts'),c('A','diamonds'),c('K','clubs'),c('7','spades'),c('4','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('one-pair')
  })
  it('detects high card', () => {
    const cards = [c('A','hearts'),c('K','diamonds'),c('9','clubs'),c('7','spades'),c('4','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(evaluateHand(cards).rank).toBe('high-card')
  })
})

describe('compareHands', () => {
  it('flush beats straight', () => {
    const flush = [c('2','hearts'),c('5','hearts'),c('7','hearts'),c('9','hearts'),c('J','hearts'),c('K','clubs'),c('3','diamonds')]
    const straight = [c('4','hearts'),c('5','diamonds'),c('6','clubs'),c('7','spades'),c('8','hearts'),c('K','clubs'),c('3','diamonds')]
    expect(compareHands(flush, straight)).toBeGreaterThan(0)
  })
  it('higher pair beats lower pair', () => {
    const pairAces = [c('A','hearts'),c('A','diamonds'),c('5','clubs'),c('7','spades'),c('9','hearts'),c('2','clubs'),c('3','diamonds')]
    const pairKings = [c('K','hearts'),c('K','diamonds'),c('5','clubs'),c('7','spades'),c('9','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(compareHands(pairAces, pairKings)).toBeGreaterThan(0)
  })
  it('same hand returns 0', () => {
    const hand = [c('A','hearts'),c('K','diamonds'),c('9','clubs'),c('7','spades'),c('4','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(compareHands(hand, hand)).toBe(0)
  })
  it('kicker breaks tie', () => {
    const highK = [c('A','hearts'),c('A','diamonds'),c('K','clubs'),c('7','spades'),c('4','hearts'),c('2','clubs'),c('3','diamonds')]
    const lowK = [c('A','hearts'),c('A','diamonds'),c('Q','clubs'),c('7','spades'),c('4','hearts'),c('2','clubs'),c('3','diamonds')]
    expect(compareHands(highK, lowK)).toBeGreaterThan(0)
  })
})
