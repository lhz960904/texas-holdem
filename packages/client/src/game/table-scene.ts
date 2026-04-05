import { Application, Container, Graphics, Text } from 'pixi.js'
import type { Card, PlayerInfo } from '@texas-holdem/shared'
import { calculateSeatPositions } from './seat-layout'
import { createCardSprite } from './card-sprite'
import { createPlayerNode } from './player-node'

export interface TableSceneState {
  players: PlayerInfo[]
  mySeatIndex: number
  communityCards: Card[]
  pot: number
  currentTurn: number
  turnDeadline: number
  hands: Map<number, { bet: number; cards?: [Card, Card] | null }>
  myCards: [Card, Card] | null
  speakingSeat: Set<number>
}

export class TableScene {
  private app: Application
  private root: Container
  private tableLayer: Container
  private cardsLayer: Container
  private playersLayer: Container

  constructor(app: Application) {
    this.app = app

    this.root = new Container()
    this.tableLayer = new Container()
    this.cardsLayer = new Container()
    this.playersLayer = new Container()

    this.root.addChild(this.tableLayer, this.cardsLayer, this.playersLayer)
    this.app.stage.addChild(this.root)
  }

  render(state: TableSceneState): void {
    // Clear all layers
    this.tableLayer.removeChildren()
    this.cardsLayer.removeChildren()
    this.playersLayer.removeChildren()

    const { width, height } = this.app.screen

    const centerX = width / 2
    const centerY = height / 2

    const tableW = width * 0.82
    const tableH = height * 0.72

    // --- Draw elliptical table felt ---
    this._drawTable(centerX, centerY, tableW, tableH)

    // --- Community cards ---
    this._drawCommunityCards(state.communityCards, centerX, centerY)

    // --- Pot display ---
    this._drawPot(state.pot, centerX, centerY)

    // --- Player nodes ---
    const totalSeats = Math.max(state.players.length, 2)
    const seatPositions = calculateSeatPositions(
      state.mySeatIndex,
      totalSeats,
      tableW,
      tableH,
      centerX,
      centerY,
    )

    const now = Date.now()
    const timeLeft =
      state.currentTurn !== null && state.turnDeadline
        ? Math.max(0, state.turnDeadline - now)
        : 0
    const totalTime = 30_000 // assume 30s turn time
    const timerProgress = totalTime > 0 ? timeLeft / totalTime : 0

    for (const player of state.players) {
      const pos = seatPositions.get(player.seatIndex)
      if (!pos) continue

      const hand = state.hands.get(player.seatIndex)
      const bet = hand?.bet ?? 0
      const isMe = player.seatIndex === state.mySeatIndex
      const isCurrentTurn = player.seatIndex === state.currentTurn

      // Determine cards to show
      let cards: [Card, Card] | null = null
      if (isMe && state.myCards) {
        cards = state.myCards
      } else if (hand?.cards) {
        cards = hand.cards
      }

      const node = createPlayerNode({
        player,
        isMe,
        isCurrentTurn,
        isSpeaking: state.speakingSeat.has(player.seatIndex),
        cards,
        bet,
        timerProgress: isCurrentTurn ? timerProgress : 1,
      })

      node.x = pos.x
      node.y = pos.y
      this.playersLayer.addChild(node)
    }
  }

  private _drawTable(cx: number, cy: number, tw: number, th: number): void {
    const rx = tw / 2
    const ry = th / 2

    // Brown border / shadow
    const border = new Graphics()
    border.ellipse(cx, cy, rx + 10, ry + 10)
    border.fill({ color: 0x5c3d1e })
    this.tableLayer.addChild(border)

    // Green felt
    const felt = new Graphics()
    felt.ellipse(cx, cy, rx, ry)
    felt.fill({ color: 0x1a5c2e })
    this.tableLayer.addChild(felt)

    // Inner decorative ring
    const ring = new Graphics()
    ring.ellipse(cx, cy, rx - 14, ry - 14)
    ring.stroke({ color: 0x2d7a48, width: 1.5, alpha: 0.7 })
    this.tableLayer.addChild(ring)

    // Subtle radial highlight (lighter center)
    const highlight = new Graphics()
    highlight.ellipse(cx, cy - ry * 0.12, rx * 0.55, ry * 0.4)
    highlight.fill({ color: 0xffffff, alpha: 0.04 })
    this.tableLayer.addChild(highlight)
  }

  private _drawCommunityCards(cards: Card[], cx: number, cy: number): void {
    const totalSlots = 5
    const cardW = 36
    const cardH = 52
    const gap = 6
    const totalW = totalSlots * cardW + (totalSlots - 1) * gap
    const startX = cx - totalW / 2
    const startY = cy - cardH / 2 - 10 // slightly above center

    for (let i = 0; i < totalSlots; i++) {
      const x = startX + i * (cardW + gap)
      const card = i < cards.length ? cards[i] : null
      const sprite = createCardSprite(card, false)

      if (card === null) {
        // Undealt slot: faded
        sprite.alpha = 0.25
      }

      sprite.x = x
      sprite.y = startY
      this.cardsLayer.addChild(sprite)
    }
  }

  private _drawPot(pot: number, cx: number, cy: number): void {
    if (pot <= 0) return

    const potY = cy - 52 / 2 - 10 - 26 // above community cards

    // Background pill
    const pillW = 90
    const pillH = 20
    const pill = new Graphics()
    pill.roundRect(cx - pillW / 2, potY - pillH / 2, pillW, pillH, pillH / 2)
    pill.fill({ color: 0x0d1520, alpha: 0.8 })
    pill.stroke({ color: 0xffd700, width: 1, alpha: 0.6 })
    this.cardsLayer.addChild(pill)

    const potText = new Text({
      text: `🏆 $${pot}`,
      style: {
        fontSize: 11,
        fill: 0xffd700,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
      },
    })
    potText.anchor.set(0.5)
    potText.x = cx
    potText.y = potY
    this.cardsLayer.addChild(potText)
  }

  destroy(): void {
    this.app.stage.removeChild(this.root)
    this.root.destroy({ children: true })
  }
}
