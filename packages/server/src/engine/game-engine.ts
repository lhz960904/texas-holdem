import { nanoid } from 'nanoid'
import type { Card, GamePhase, GameState, PlayerStatus, SidePot } from '@texas-holdem/shared'
import { createDeck, shuffleDeck } from '@texas-holdem/shared'
import { HAND_RANK_NAMES } from '@texas-holdem/shared'
import { evaluateHand } from './hand-evaluator'
import { calculateSidePots } from './pot-calculator'

export interface SettleResult {
  winners: { seatIndex: number; amount: number; potIndex: number }[]
  showdown: boolean
  showdownResults?: { seatIndex: number; cards: [Card, Card]; handRank: string; handName: string }[]
}

interface PlayerState {
  seatIndex: number
  playerId: string
  chips: number
  status: PlayerStatus
  bet: number         // current round bet
  totalBet: number    // total bet this hand
  hasActed: boolean
  cards?: [Card, Card]
}

export class GameEngine {
  private state: GameState
  private players: Map<number, PlayerState> = new Map()
  private deck: Card[] = []
  private currentBet = 0
  private minRaise = 0
  private smallBlind = 10
  private bigBlind = 20

  constructor(smallBlind = 10, bigBlind = 20) {
    this.smallBlind = smallBlind
    this.bigBlind = bigBlind
    this.state = {
      id: nanoid(),
      phase: 'waiting',
      dealerSeat: 0,
      pot: 0,
      communityCards: [],
      currentTurn: -1,
      turnDeadline: 0,
      sidePots: [],
    }
  }

  addPlayer(seatIndex: number, playerId: string, chips: number): void {
    this.players.set(seatIndex, {
      seatIndex,
      playerId,
      chips,
      status: 'sitting',
      bet: 0,
      totalBet: 0,
      hasActed: false,
    })
  }

  removePlayer(seatIndex: number): void {
    this.players.delete(seatIndex)
  }

  startHand(dealerSeat: number): void {
    this.state.id = nanoid()
    this.state.phase = 'preflop'
    this.state.dealerSeat = dealerSeat
    this.state.pot = 0
    this.state.communityCards = []
    this.state.sidePots = []
    this.currentBet = 0
    this.minRaise = this.bigBlind

    // Reset all players
    for (const player of this.players.values()) {
      player.status = 'active'
      player.bet = 0
      player.totalBet = 0
      player.hasActed = false
      player.cards = undefined
    }

    // Shuffle and deal
    this.deck = shuffleDeck(createDeck())
    const seats = this.getActiveSeatsSorted()

    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      for (const seat of seats) {
        const player = this.players.get(seat)!
        const card = this.deck.pop()!
        if (!player.cards) {
          player.cards = [card, card] // temp
        } else {
          player.cards = [player.cards[0], card]
        }
      }
    }

    // Post blinds: SB = next after dealer, BB = next after SB
    const sbSeat = this.nextActiveSeat(dealerSeat)
    const bbSeat = this.nextActiveSeat(sbSeat)

    this.postBlind(sbSeat, this.smallBlind)
    this.postBlind(bbSeat, this.bigBlind)
    this.currentBet = this.bigBlind
    this.minRaise = this.bigBlind

    // UTG starts: left of BB
    this.state.currentTurn = this.nextActiveSeat(bbSeat)
    this.state.turnDeadline = Date.now() + 30000
  }

  private postBlind(seatIndex: number, amount: number): void {
    const player = this.players.get(seatIndex)
    if (!player) return
    const actual = Math.min(amount, player.chips)
    player.chips -= actual
    player.bet += actual
    player.totalBet += actual
    if (player.chips === 0) {
      player.status = 'allIn'
    }
  }

  handleAction(seatIndex: number, type: 'fold' | 'check' | 'call' | 'raise' | 'allIn', amount?: number): boolean {
    const player = this.players.get(seatIndex)
    if (!player) return false
    if (this.state.currentTurn !== seatIndex) return false
    if (player.status === 'folded' || player.status === 'allIn') return false

    switch (type) {
      case 'fold':
        player.status = 'folded'
        player.hasActed = true
        break

      case 'check':
        if (this.currentBet !== player.bet) return false
        player.hasActed = true
        break

      case 'call': {
        const callAmount = Math.min(this.currentBet - player.bet, player.chips)
        player.chips -= callAmount
        player.bet += callAmount
        player.totalBet += callAmount
        if (player.chips === 0) player.status = 'allIn'
        player.hasActed = true
        break
      }

      case 'raise': {
        if (amount === undefined) return false
        const totalRaiseTarget = amount
        const additionalNeeded = totalRaiseTarget - player.bet
        if (additionalNeeded <= 0) return false

        // Must be at least currentBet + minRaise (unless going all-in)
        const minTarget = this.currentBet + this.minRaise
        if (totalRaiseTarget < minTarget && additionalNeeded < player.chips) return false

        const actual = Math.min(additionalNeeded, player.chips)
        player.chips -= actual
        player.bet += actual
        player.totalBet += actual

        if (player.chips === 0) player.status = 'allIn'

        const raiseBy = player.bet - this.currentBet
        if (raiseBy > 0) {
          this.minRaise = raiseBy
          this.currentBet = player.bet
          // Reset hasActed for all other active players
          for (const p of this.players.values()) {
            if (p.seatIndex !== seatIndex && p.status === 'active') {
              p.hasActed = false
            }
          }
        }
        player.hasActed = true
        break
      }

      case 'allIn': {
        const allInAmount = player.chips
        if (allInAmount <= 0) return false
        player.bet += allInAmount
        player.totalBet += allInAmount
        player.chips = 0
        player.status = 'allIn'

        if (player.bet > this.currentBet) {
          const raiseBy = player.bet - this.currentBet
          this.minRaise = raiseBy
          this.currentBet = player.bet
          // Reset hasActed for all other active players
          for (const p of this.players.values()) {
            if (p.seatIndex !== seatIndex && p.status === 'active') {
              p.hasActed = false
            }
          }
        }
        player.hasActed = true
        break
      }

      default:
        return false
    }

    this.advancePhase()
    return true
  }

  private getActiveSeatsSorted(): number[] {
    return [...this.players.keys()].sort((a, b) => a - b)
  }

  private nextActiveSeat(fromSeat: number): number {
    const seats = this.getActiveSeatsSorted()
    if (seats.length === 0) return -1
    const idx = seats.indexOf(fromSeat)
    return seats[(idx + 1) % seats.length]
  }

  private nextActionableSeat(fromSeat: number): number {
    const seats = this.getActiveSeatsSorted()
    if (seats.length === 0) return -1
    let idx = seats.indexOf(fromSeat)
    for (let i = 0; i < seats.length; i++) {
      idx = (idx + 1) % seats.length
      const seat = seats[idx]
      const p = this.players.get(seat)!
      if (p.status === 'active') return seat
    }
    return -1
  }

  private collectBets(): void {
    for (const player of this.players.values()) {
      this.state.pot += player.bet
      player.bet = 0
    }
  }

  private resetBettingRound(): void {
    this.currentBet = 0
    this.minRaise = this.bigBlind
    for (const player of this.players.values()) {
      if (player.status === 'active') {
        player.hasActed = false
      }
    }
  }

  private nonFoldedPlayers(): PlayerState[] {
    return [...this.players.values()].filter(p => p.status !== 'folded')
  }

  private actionablePlayers(): PlayerState[] {
    return [...this.players.values()].filter(p => p.status === 'active')
  }

  private advancePhase(): void {
    const nonFolded = this.nonFoldedPlayers()

    // Only 1 player left -> settle immediately
    if (nonFolded.length <= 1) {
      this.collectBets()
      this.state.phase = 'settle'
      this.state.currentTurn = -1
      return
    }

    const actionable = this.actionablePlayers()
    const allActed = actionable.every(p => p.hasActed && p.bet === this.currentBet)
    const noActionable = actionable.length === 0

    if (!allActed && !noActionable) {
      // Find next player who needs to act
      const next = this.nextActionableSeat(this.state.currentTurn)
      this.state.currentTurn = next
      this.state.turnDeadline = Date.now() + 30000
      return
    }

    // Move to next phase
    this.collectBets()
    const nextPhase = this.getNextPhase()

    if (nextPhase === 'showdown' || noActionable) {
      // Deal remaining community cards then go to showdown
      this.dealRemainingCards()
      this.state.phase = 'showdown'
      this.state.currentTurn = -1
      return
    }

    if (nextPhase === 'settle') {
      this.state.phase = 'settle'
      this.state.currentTurn = -1
      return
    }

    // Deal community cards for new phase
    this.state.phase = nextPhase
    this.dealCommunityCards(nextPhase)
    this.resetBettingRound()

    // Find first actionable seat (starting from dealer + 1)
    const firstSeat = this.nextActionableSeatFromDealer()
    this.state.currentTurn = firstSeat
    this.state.turnDeadline = Date.now() + 30000
  }

  private dealRemainingCards(): void {
    const needed = 5 - this.state.communityCards.length
    for (let i = 0; i < needed; i++) {
      this.state.communityCards.push(this.deck.pop()!)
    }
  }

  private dealCommunityCards(phase: GamePhase): void {
    if (phase === 'flop') {
      for (let i = 0; i < 3; i++) this.state.communityCards.push(this.deck.pop()!)
    } else if (phase === 'turn' || phase === 'river') {
      this.state.communityCards.push(this.deck.pop()!)
    }
  }

  private getNextPhase(): GamePhase {
    switch (this.state.phase) {
      case 'preflop': return 'flop'
      case 'flop': return 'turn'
      case 'turn': return 'river'
      case 'river': return 'showdown'
      default: return 'settle'
    }
  }

  private nextActionableSeatFromDealer(): number {
    const seats = this.getActiveSeatsSorted()
    if (seats.length === 0) return -1
    const dealerIdx = seats.indexOf(this.state.dealerSeat)
    for (let i = 1; i <= seats.length; i++) {
      const idx = (dealerIdx + i) % seats.length
      const seat = seats[idx]
      const p = this.players.get(seat)!
      if (p.status === 'active') return seat
    }
    return -1
  }

  settle(): SettleResult {
    const nonFolded = this.nonFoldedPlayers()
    const showdown = nonFolded.length > 1

    // Build side pots
    const betInfos = [...this.players.values()].map(p => ({
      seatIndex: p.seatIndex,
      totalBet: p.totalBet,
      isAllIn: p.status === 'allIn',
      isFolded: p.status === 'folded',
    }))
    const sidePots = calculateSidePots(betInfos)
    this.state.sidePots = sidePots

    // When only 1 non-folded player remains, give them all pot(s) directly
    if (!showdown) {
      const winner = nonFolded[0]
      const winners: SettleResult['winners'] = []
      for (let potIdx = 0; potIdx < sidePots.length; potIdx++) {
        const pot = sidePots[potIdx]
        if (winner && pot.eligible.includes(winner.seatIndex)) {
          winner.chips += pot.amount
          winners.push({ seatIndex: winner.seatIndex, amount: pot.amount, potIndex: potIdx })
        } else if (winner) {
          // give them everything regardless (everyone else folded)
          winner.chips += pot.amount
          winners.push({ seatIndex: winner.seatIndex, amount: pot.amount, potIndex: potIdx })
        }
      }
      // Also add back any uncollected pot (bets already collected into state.pot)
      if (sidePots.length === 0 && winner) {
        winner.chips += this.state.pot
        winners.push({ seatIndex: winner.seatIndex, amount: this.state.pot, potIndex: 0 })
      }
      this.state.phase = 'settle'
      return { winners, showdown: false }
    }

    // Evaluate hands for non-folded players with cards
    const handResults: Map<number, ReturnType<typeof evaluateHand>> = new Map()
    for (const p of nonFolded) {
      if (p.cards && p.cards.length + this.state.communityCards.length >= 5) {
        const allCards = [...p.cards, ...this.state.communityCards]
        const result = evaluateHand(allCards)
        if (result) handResults.set(p.seatIndex, result)
      }
    }

    const winners: SettleResult['winners'] = []

    for (let potIdx = 0; potIdx < sidePots.length; potIdx++) {
      const pot = sidePots[potIdx]
      const eligibleWithHands = pot.eligible.filter(s => handResults.has(s))

      if (eligibleWithHands.length === 0) continue

      // Find best hand(s) among eligible
      let bestRankValue = -1
      let bestKickers: number[] = []

      for (const s of eligibleWithHands) {
        const h = handResults.get(s)!
        if (h.rankValue > bestRankValue) {
          bestRankValue = h.rankValue
          bestKickers = h.kickers
        } else if (h.rankValue === bestRankValue) {
          // Compare kickers
          for (let i = 0; i < Math.max(h.kickers.length, bestKickers.length); i++) {
            const a = h.kickers[i] ?? 0
            const b = bestKickers[i] ?? 0
            if (a > b) { bestKickers = h.kickers; break }
            if (a < b) break
          }
        }
      }

      const potWinners = eligibleWithHands.filter(s => {
        const h = handResults.get(s)!
        if (h.rankValue !== bestRankValue) return false
        for (let i = 0; i < Math.max(h.kickers.length, bestKickers.length); i++) {
          if ((h.kickers[i] ?? 0) !== (bestKickers[i] ?? 0)) return false
        }
        return true
      })

      const share = Math.floor(pot.amount / potWinners.length)
      const remainder = pot.amount - share * potWinners.length

      for (let i = 0; i < potWinners.length; i++) {
        const s = potWinners[i]
        const amount = share + (i === 0 ? remainder : 0)
        this.players.get(s)!.chips += amount
        winners.push({ seatIndex: s, amount, potIndex: potIdx })
      }
    }

    this.state.phase = 'settle'

    const result: SettleResult = { winners, showdown }

    if (showdown) {
      result.showdownResults = nonFolded
        .filter(p => p.cards)
        .map(p => {
          const h = handResults.get(p.seatIndex)!
          return {
            seatIndex: p.seatIndex,
            cards: p.cards!,
            handRank: h.rank,
            handName: HAND_RANK_NAMES[h.rank] ?? h.rank,
          }
        })
    }

    return result
  }

  getState(): GameState {
    return { ...this.state }
  }

  getPlayerCards(seat: number): [Card, Card] | undefined {
    return this.players.get(seat)?.cards
  }

  getPlayerState(seat: number): PlayerState | undefined {
    return this.players.get(seat)
  }

  getPlayerHand(seat: number) {
    const p = this.players.get(seat)
    if (!p?.cards) return undefined
    const allCards = [...p.cards, ...this.state.communityCards]
    return evaluateHand(allCards)
  }

  getAllPlayerHands() {
    const result: Map<number, ReturnType<typeof evaluateHand>> = new Map()
    for (const p of this.players.values()) {
      if (p.cards) {
        const allCards = [...p.cards, ...this.state.communityCards]
        result.set(p.seatIndex, evaluateHand(allCards))
      }
    }
    return result
  }

  getCurrentBet(): number {
    return this.currentBet
  }

  getMinRaise(): number {
    return this.minRaise
  }

  getPhase(): GamePhase {
    return this.state.phase
  }
}
