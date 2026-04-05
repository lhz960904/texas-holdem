import { describe, it, expect, beforeEach } from 'vitest'
import { GameEngine } from '../engine/game-engine'

function setupEngine(playerCount = 3, smallBlind = 10, bigBlind = 20) {
  const engine = new GameEngine(smallBlind, bigBlind)
  for (let i = 0; i < playerCount; i++) {
    engine.addPlayer(i, `player-${i}`, 1000)
  }
  return engine
}

describe('GameEngine', () => {
  describe('startHand', () => {
    it('starts hand and deals 2 cards per player', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      const state = engine.getState()
      expect(state.phase).toBe('preflop')

      for (let i = 0; i < 3; i++) {
        const cards = engine.getPlayerCards(i)
        expect(cards).toHaveLength(2)
        expect(cards![0]).toHaveProperty('rank')
        expect(cards![0]).toHaveProperty('suit')
        expect(cards![1]).toHaveProperty('rank')
        expect(cards![1]).toHaveProperty('suit')
      }
    })

    it('deducts blinds correctly (dealer=0 → SB=1 loses 10, BB=2 loses 20)', () => {
      const engine = setupEngine(3)
      engine.startHand(0)

      // SB = seat 1, BB = seat 2
      const sb = engine.getPlayerState(1)!
      const bb = engine.getPlayerState(2)!

      expect(sb.chips).toBe(990) // 1000 - 10
      expect(sb.bet).toBe(10)
      expect(bb.chips).toBe(980) // 1000 - 20
      expect(bb.bet).toBe(20)
    })

    it('action order starts left of BB in preflop', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // dealer=0, SB=1, BB=2, UTG=0
      const state = engine.getState()
      expect(state.currentTurn).toBe(0)
    })
  })

  describe('handleAction', () => {
    it('processes fold: status becomes folded', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // seat 0 is UTG, fold
      engine.handleAction(0, 'fold')
      const p = engine.getPlayerState(0)!
      expect(p.status).toBe('folded')
    })

    it('processes call: chips decrease by call amount', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // seat 0 is UTG, call BB=20
      engine.handleAction(0, 'call')
      const p = engine.getPlayerState(0)!
      expect(p.chips).toBe(980) // 1000 - 20
      expect(p.bet).toBe(20)
    })

    it('processes raise: bet updates correctly', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // seat 0 raises to 60 (min is 20 + 20 = 40)
      engine.handleAction(0, 'raise', 60)
      const p = engine.getPlayerState(0)!
      expect(p.bet).toBe(60)
      expect(engine.getCurrentBet()).toBe(60)
    })

    it('processes check: valid when no bet to match', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // Get to flop with everyone calling/checking
      // Seat 0 calls, seat 1 calls (already has 10, need 10 more), seat 2 checks
      engine.handleAction(0, 'call')  // seat 0 calls 20
      engine.handleAction(1, 'call')  // seat 1 calls (has 10, pays 10 more)
      engine.handleAction(2, 'check') // seat 2 BB checks

      // Now on flop, seat 1 (SB, first to act after dealer) should be able to check
      const state = engine.getState()
      expect(state.phase).toBe('flop')
      expect(state.communityCards).toHaveLength(3)

      // First actionable on flop
      const firstSeat = state.currentTurn
      const result = engine.handleAction(firstSeat, 'check')
      expect(result).toBe(true)
    })

    it('advances to flop after all act: 3 community cards appear', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // dealer=0, SB=1, BB=2, UTG=0
      engine.handleAction(0, 'call')  // seat 0 calls
      engine.handleAction(1, 'call')  // seat 1 calls (SB tops up)
      engine.handleAction(2, 'check') // seat 2 BB checks

      const state = engine.getState()
      expect(state.phase).toBe('flop')
      expect(state.communityCards).toHaveLength(3)
    })

    it('ends hand when all but one fold: phase = settle', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // dealer=0, SB=1, BB=2, UTG=0
      engine.handleAction(0, 'fold') // seat 0 folds
      engine.handleAction(1, 'fold') // seat 1 folds, only seat 2 remains

      const state = engine.getState()
      expect(state.phase).toBe('settle')
    })

    it('handles all-in: chips = 0, status = allIn', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // seat 0 goes all-in
      engine.handleAction(0, 'allIn')
      const p = engine.getPlayerState(0)!
      expect(p.chips).toBe(0)
      expect(p.status).toBe('allIn')
    })

    it('does not allow action out of turn', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // currentTurn is 0, trying to act as seat 1 should fail
      const result = engine.handleAction(1, 'call')
      expect(result).toBe(false)
    })

    it('resets other players hasActed after a raise', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // seat 0 calls (has acted)
      engine.handleAction(0, 'call')
      // seat 1 raises
      engine.handleAction(1, 'raise', 60)
      // seat 0 should need to act again (hasActed = false)
      const p0 = engine.getPlayerState(0)!
      expect(p0.hasActed).toBe(false)
    })
  })

  describe('settle', () => {
    it('distributes pot to winner when others fold', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      engine.handleAction(0, 'fold')
      engine.handleAction(1, 'fold')
      // seat 2 wins
      const state = engine.getState()
      expect(state.phase).toBe('settle')

      const result = engine.settle()
      // pot = blinds: 10 + 20 = 30
      expect(result.winners.length).toBeGreaterThan(0)
      const winner = result.winners.find(w => w.seatIndex === 2)
      expect(winner).toBeDefined()
      expect(result.showdown).toBe(false)
    })

    it('showdown occurs when multiple players remain', () => {
      const engine = setupEngine(3)
      engine.startHand(0)
      // All call, check through to showdown
      engine.handleAction(0, 'call')
      engine.handleAction(1, 'call')
      engine.handleAction(2, 'check')
      // Flop: check around
      const flopTurn = engine.getState().currentTurn
      engine.handleAction(flopTurn, 'check')
      engine.handleAction(engine.getState().currentTurn, 'check')
      engine.handleAction(engine.getState().currentTurn, 'check')
      // Turn: check around
      engine.handleAction(engine.getState().currentTurn, 'check')
      engine.handleAction(engine.getState().currentTurn, 'check')
      engine.handleAction(engine.getState().currentTurn, 'check')
      // River: check around
      engine.handleAction(engine.getState().currentTurn, 'check')
      engine.handleAction(engine.getState().currentTurn, 'check')
      engine.handleAction(engine.getState().currentTurn, 'check')

      expect(engine.getPhase()).toBe('showdown')
      const result = engine.settle()
      expect(result.showdown).toBe(true)
      expect(result.showdownResults).toBeDefined()
      expect(result.showdownResults!.length).toBe(3)
    })
  })
})
