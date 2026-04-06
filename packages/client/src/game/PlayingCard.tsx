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
}

export function PlayingCard({ card, small, className = '' }: PlayingCardProps) {
  const sizeClass = small ? 'w-6 h-9 text-[10px]' : 'w-9 h-13 text-sm'

  if (!card) {
    // Face down
    return (
      <div
        data-testid="card"
        className={`${sizeClass} rounded-md flex items-center justify-center shadow-md select-none ${className}`}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2c2c54 50%, #1e3a5f 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <div
          className="w-[70%] h-[70%] rounded-sm"
          style={{
            background:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 2px, transparent 2px, transparent 4px)',
          }}
        />
      </div>
    )
  }

  const isRed = RED_SUITS.has(card.suit)
  const suitSymbol = SUIT_SYMBOLS[card.suit] ?? card.suit
  const color = isRed ? 'text-red-500' : 'text-gray-900'

  return (
    <div
      data-testid="card"
      className={`${sizeClass} rounded-md bg-white border border-gray-200 flex flex-col items-center justify-center shadow-md select-none ${color} ${className}`}
      style={{ animation: 'dealCard 0.3s ease-out' }}
    >
      <span className="font-bold leading-none">{card.rank}</span>
      <span className="leading-none">{suitSymbol}</span>
    </div>
  )
}
