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
  small?: boolean
  large?: boolean // for bottom HUD own hand
  className?: string
  animationDelay?: number
}

export function PlayingCard({ card, small, large, className = '', animationDelay = 0 }: PlayingCardProps) {
  const sizeClass = large
    ? 'w-20 h-28 rounded-xl p-3'
    : small
      ? 'w-12 h-[68px] rounded-lg'
      : 'w-16 h-24 rounded-lg'

  if (!card) {
    // Face down
    return (
      <div
        data-testid="card"
        className={`${sizeClass} card-shadow bg-[#2a2a2a] border-2 border-[#e9c349]/20 flex items-center justify-center relative overflow-hidden select-none ${className}`}
        style={{
          animation: animationDelay > 0 ? `dealIn 0.35s ease-out ${animationDelay}ms both` : undefined,
        }}
      >
        {/* Diamond pattern */}
        <div className="absolute inset-[3px] rounded-[inherit] border border-[#e9c349]/15 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, #e9c349 0px, #e9c349 1px, transparent 1px, transparent 8px),
                              repeating-linear-gradient(-45deg, #e9c349 0px, #e9c349 1px, transparent 1px, transparent 8px)`,
          }} />
        </div>
        <div className="relative text-[#e9c349]/20 text-sm font-bold">♠</div>
      </div>
    )
  }

  const isRed = RED_SUITS.has(card.suit)
  const suitSymbol = SUIT_SYMBOLS[card.suit] ?? card.suit
  const colorClass = isRed ? 'text-red-500' : 'text-[#131313]'

  const rankSize = large ? 'text-2xl' : small ? 'text-sm' : 'text-lg'
  const suitSize = large ? 'text-2xl' : small ? 'text-sm' : 'text-lg'
  const centerSuitSize = large ? 'text-5xl' : small ? 'text-2xl' : 'text-4xl'

  return (
    <div
      data-testid="card"
      className={`${sizeClass} flex flex-col justify-between p-2 card-shadow bg-[#e5e2e1] select-none ${className}`}
      style={{
        animation: animationDelay > 0 ? `dealIn 0.35s ease-out ${animationDelay}ms both` : 'dealIn 0.35s ease-out',
      }}
    >
      <div className="flex flex-col items-start leading-none">
        <span className={`font-bold ${colorClass} ${rankSize}`}>
          {card.rank}
        </span>
        <span className={`${colorClass} ${suitSize}`}>
          {suitSymbol}
        </span>
      </div>
    </div>
  )
}
