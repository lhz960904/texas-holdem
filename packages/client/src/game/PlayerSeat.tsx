import type { Card, PlayerInfo } from '@texas-holdem/shared'
import { PlayingCard } from './PlayingCard'

interface PlayerSeatProps {
  player: PlayerInfo
  isCurrentTurn: boolean
  cards: [Card, Card] | null
  bet: number
  isDealer: boolean
  style: React.CSSProperties
}

function parseAvatar(avatar: string): { emoji: string; color: string } {
  const parts = avatar.split(':')
  return { emoji: parts[0] || '👤', color: parts[1] || '#888888' }
}

export function PlayerSeat({
  player,
  isCurrentTurn,
  cards,
  bet,
  isDealer,
  style,
}: PlayerSeatProps) {
  const { emoji, color } = parseAvatar(player.avatar)
  const isFolded = player.status === 'folded'

  return (
    <div
      data-testid="player-seat"
      data-seat={player.seatIndex}
      className={`absolute flex flex-col items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 ${isFolded ? 'grayscale opacity-50' : ''}`}
      style={{
        ...style,
        transition: 'opacity 0.5s ease, filter 0.5s ease',
      }}
    >
      {/* Cards (small, above avatar) */}
      {!isFolded && (
        <div className="flex gap-1">
          <PlayingCard card={cards?.[0] ?? null} small />
          <PlayingCard card={cards?.[1] ?? null} small />
        </div>
      )}

      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full border-2 ${isCurrentTurn ? 'border-[#96d59b]' : 'border-[#414940]'} overflow-hidden bg-[#2a2a2a] flex items-center justify-center text-2xl`}
          style={{ backgroundColor: color }}
        >
          {emoji}
        </div>
        {isDealer && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white text-black font-bold text-[9px] flex items-center justify-center">
            D
          </div>
        )}
        {isCurrentTurn && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#96d59b] text-[#131313] text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase whitespace-nowrap">
            Thinking
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="bg-black/60 px-3 py-1 rounded-full text-center min-w-[70px]">
        <div className="text-[9px] font-bold text-white/50 uppercase tracking-tight truncate max-w-[80px]">
          {player.nickname}
        </div>
        <div className="text-[11px] font-headline font-bold text-[#e9c349]">
          {player.chips.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
