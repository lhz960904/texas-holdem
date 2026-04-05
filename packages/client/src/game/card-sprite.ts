import { Container, Graphics, Text } from 'pixi.js'
import type { Card } from '@texas-holdem/shared'

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const RED_SUITS = new Set(['hearts', 'diamonds'])

/**
 * Create a card visual as a Pixi Container.
 * - Face up (card provided): white rounded rect with rank + suit text.
 *   Red for hearts/diamonds.
 * - Face down (null): dark blue rounded rect with faint spade symbol.
 * - Normal size: 36×52px.  Small size: 26×38px.
 */
export function createCardSprite(card: Card | null, small?: boolean): Container {
  const container = new Container()

  const w = small ? 26 : 36
  const h = small ? 38 : 52
  const radius = small ? 3 : 4

  const bg = new Graphics()

  if (card) {
    // Face-up card
    bg.roundRect(0, 0, w, h, radius)
    bg.fill({ color: 0xffffff })
    bg.roundRect(0, 0, w, h, radius)
    bg.stroke({ color: 0xcccccc, width: 1 })

    const isRed = RED_SUITS.has(card.suit)
    const color = isRed ? '#e53935' : '#1a1a2e'

    const suitSymbol = SUIT_SYMBOLS[card.suit] ?? card.suit

    const rankText = new Text({
      text: card.rank,
      style: {
        fontSize: small ? 9 : 12,
        fontWeight: 'bold',
        fill: color,
        fontFamily: 'Arial, sans-serif',
      },
    })
    rankText.x = 2
    rankText.y = 1

    const suitText = new Text({
      text: suitSymbol,
      style: {
        fontSize: small ? 9 : 14,
        fill: color,
        fontFamily: 'Arial, sans-serif',
      },
    })
    suitText.x = w / 2 - suitText.width / 2
    suitText.y = h / 2 - suitText.height / 2

    container.addChild(bg, rankText, suitText)
  } else {
    // Face-down card
    bg.roundRect(0, 0, w, h, radius)
    bg.fill({ color: 0x1a2d5a })
    bg.roundRect(0, 0, w, h, radius)
    bg.stroke({ color: 0x2a4080, width: 1 })

    // Inner pattern
    const inner = new Graphics()
    inner.roundRect(3, 3, w - 6, h - 6, 2)
    inner.stroke({ color: 0x2a4080, width: 1 })

    const spade = new Text({
      text: '♠',
      style: {
        fontSize: small ? 10 : 14,
        fill: 0x2a4080,
        fontFamily: 'Arial, sans-serif',
      },
    })
    spade.x = w / 2 - spade.width / 2
    spade.y = h / 2 - spade.height / 2

    container.addChild(bg, inner, spade)
  }

  return container
}
