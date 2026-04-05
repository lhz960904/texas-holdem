import { describe, it, expect } from 'vitest'
import { SUITS, RANKS, createDeck, type Card } from '../types'

describe('Card types', () => {
  it('has 4 suits', () => { expect(SUITS).toHaveLength(4) })
  it('has 13 ranks', () => { expect(RANKS).toHaveLength(13) })
  it('createDeck produces 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    const serialized = deck.map((c: Card) => `${c.rank}${c.suit}`)
    expect(new Set(serialized).size).toBe(52)
  })
})
