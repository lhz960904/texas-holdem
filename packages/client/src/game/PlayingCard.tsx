import type { Card } from '@texas-holdem/shared'

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const RED_SUITS = new Set(['hearts', 'diamonds'])

interface PlayingCardProps {
  card: Card | null // null = face down
  small?: boolean // true for small cards on player nodes
  className?: string
  animationDelay?: number // ms delay for staggered deal animation
}

export function PlayingCard({ card, small, className = '', animationDelay = 0 }: PlayingCardProps) {
  const sizeClass = small ? 'w-8 h-11 text-[10px]' : 'w-11 h-16 text-sm'

  if (!card) {
    // Face down — deep blue gradient with diamond pattern overlay
    return (
      <div
        data-testid="card"
        className={`${sizeClass} rounded-[6px] flex items-center justify-center select-none relative overflow-hidden ${className}`}
        style={{
          background: 'linear-gradient(135deg, #1a3a6b 0%, #0f2248 50%, #1a3a6b 100%)',
          border: '1px solid rgba(100,150,255,0.25)',
          boxShadow: '2px 3px 10px rgba(0,0,0,0.5), inset 0 0 15px rgba(100,150,255,0.08)',
          animation: animationDelay > 0 ? `dealIn 0.35s ease-out ${animationDelay}ms both` : undefined,
        }}
      >
        {/* Diamond pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
              linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%),
              linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)
            `,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
          }}
        />
        {/* Center emblem */}
        <div
          className="w-[50%] h-[50%] rounded-full relative z-10"
          style={{
            border: '1px solid rgba(100,150,255,0.15)',
            background: 'radial-gradient(circle, rgba(100,150,255,0.1) 0%, transparent 70%)',
          }}
        />
      </div>
    )
  }

  const isRed = RED_SUITS.has(card.suit)
  const suitSymbol = SUIT_SYMBOLS[card.suit] ?? card.suit
  const textColor = isRed ? '#dc2626' : '#1a1a2e'

  return (
    <div
      data-testid="card"
      className={`${sizeClass} rounded-[6px] flex flex-col items-center justify-center select-none relative ${className}`}
      style={{
        background: 'linear-gradient(145deg, #fff, #f8f8f8)',
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '2px 3px 10px rgba(0,0,0,0.5)',
        color: textColor,
        animation: animationDelay > 0 ? `dealIn 0.35s ease-out ${animationDelay}ms both` : 'dealIn 0.35s ease-out',
      }}
    >
      <span className="font-bold leading-none">{card.rank}</span>
      <span className="leading-none">{suitSymbol}</span>
    </div>
  )
}
