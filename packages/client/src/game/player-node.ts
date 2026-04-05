import { Container, Graphics, Text } from 'pixi.js'
import type { Card, PlayerInfo } from '@texas-holdem/shared'
import { createCardSprite } from './card-sprite'

export interface PlayerNodeOptions {
  player: PlayerInfo
  isMe: boolean
  isCurrentTurn: boolean
  isSpeaking: boolean
  cards: [Card, Card] | null
  bet: number
  timerProgress: number // 0..1, 1 = full time remaining
}

/**
 * Create a player node as a Pixi Container.
 * Centered at (0, 0) — caller positions it.
 */
export function createPlayerNode(opts: PlayerNodeOptions): Container {
  const { player, isMe, isCurrentTurn, isSpeaking, cards, bet, timerProgress } = opts
  const container = new Container()

  const isFolded = player.status === 'folded'
  if (isFolded) container.alpha = 0.4

  // Parse avatar: "emoji:color" → e.g. "🐶:#f4a261"
  const avatarParts = player.avatar.split(':')
  const emoji = avatarParts[0] ?? '👤'
  const colorHex = avatarParts[1] ?? '#888888'
  const bgColor = parseInt(colorHex.replace('#', ''), 16)

  const radius = 22

  // --- Glow / active ring ---
  if (isCurrentTurn) {
    const glow = new Graphics()
    glow.circle(0, 0, radius + 5)
    glow.fill({ color: 0xffd700, alpha: 0.35 })
    glow.circle(0, 0, radius + 5)
    glow.stroke({ color: 0xffd700, width: 2.5 })
    container.addChild(glow)
  }

  if (isSpeaking) {
    const ring = new Graphics()
    ring.circle(0, 0, radius + 4)
    ring.stroke({ color: 0x22c55e, width: 2.5 })
    container.addChild(ring)
  }

  // --- Avatar background circle ---
  const avatarBg = new Graphics()
  avatarBg.circle(0, 0, radius)
  avatarBg.fill({ color: bgColor })
  avatarBg.circle(0, 0, radius)
  avatarBg.stroke({ color: 0xffffff, width: isMe ? 2 : 1, alpha: isMe ? 0.9 : 0.4 })
  container.addChild(avatarBg)

  // --- Emoji ---
  const emojiText = new Text({
    text: emoji,
    style: {
      fontSize: 20,
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif',
    },
  })
  emojiText.anchor.set(0.5)
  emojiText.x = 0
  emojiText.y = 0
  container.addChild(emojiText)

  // --- Name label ---
  const nameText = new Text({
    text: player.nickname,
    style: {
      fontSize: 10,
      fill: 0xffffff,
      fontFamily: 'Arial, sans-serif',
      stroke: { color: 0x000000, width: 2 },
    },
  })
  nameText.anchor.set(0.5, 0)
  nameText.x = 0
  nameText.y = radius + 4
  container.addChild(nameText)

  // --- Chips label ---
  const chipsText = new Text({
    text: `$${player.chips}`,
    style: {
      fontSize: 10,
      fill: 0xffd700,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    },
  })
  chipsText.anchor.set(0.5, 0)
  chipsText.x = 0
  chipsText.y = radius + 16
  container.addChild(chipsText)

  // --- Cards above avatar ---
  if (cards) {
    const cardContainer = new Container()
    const cardW = 26
    const gap = 4
    const totalW = cardW * 2 + gap
    cardContainer.x = -totalW / 2
    cardContainer.y = -(radius + 44)

    const c0 = createCardSprite(cards[0], true)
    const c1 = createCardSprite(cards[1], true)
    c1.x = cardW + gap
    cardContainer.addChild(c0, c1)
    container.addChild(cardContainer)
  } else if (!isFolded) {
    // Face-down placeholders for non-folded opponents
    const cardContainer = new Container()
    const cardW = 26
    const gap = 4
    const totalW = cardW * 2 + gap
    cardContainer.x = -totalW / 2
    cardContainer.y = -(radius + 44)

    const c0 = createCardSprite(null, true)
    const c1 = createCardSprite(null, true)
    c1.x = cardW + gap
    cardContainer.addChild(c0, c1)
    container.addChild(cardContainer)
  }

  // --- Timer bar (only for current turn) ---
  if (isCurrentTurn) {
    const barW = 48
    const barH = 5
    const barY = radius + 32

    // Background
    const barBg = new Graphics()
    barBg.roundRect(-barW / 2, barY, barW, barH, 2)
    barBg.fill({ color: 0x333333 })
    container.addChild(barBg)

    // Progress
    const progress = Math.max(0, Math.min(1, timerProgress))
    if (progress > 0) {
      const fillColor =
        progress > 0.5 ? 0x22c55e : progress > 0.25 ? 0xf59e0b : 0xef4444
      const barFill = new Graphics()
      barFill.roundRect(-barW / 2, barY, barW * progress, barH, 2)
      barFill.fill({ color: fillColor })
      container.addChild(barFill)
    }
  }

  // --- Bet display ---
  if (bet > 0) {
    const pillW = 44
    const pillH = 16
    const pillY = -(radius + 54)

    const pill = new Graphics()
    pill.roundRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2)
    pill.fill({ color: 0x1e293b, alpha: 0.85 })
    pill.stroke({ color: 0xffd700, width: 1 })
    container.addChild(pill)

    const betText = new Text({
      text: `$${bet}`,
      style: {
        fontSize: 9,
        fill: 0xffd700,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
      },
    })
    betText.anchor.set(0.5)
    betText.x = 0
    betText.y = pillY
    container.addChild(betText)
  }

  return container
}
