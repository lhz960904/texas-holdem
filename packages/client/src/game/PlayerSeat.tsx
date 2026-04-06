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
      className={`absolute flex items-center gap-2 -translate-x-1/2 -translate-y-1/2 ${isFolded ? 'grayscale opacity-40' : ''}`}
      style={{
        ...style,
        transition: 'opacity 0.5s ease, filter 0.5s ease',
      }}
    >
      {/* Avatar (small) */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-9 h-9 rounded-full border-2 ${isCurrentTurn ? 'border-[#96d59b] shadow-[0_0_10px_rgba(150,213,155,0.4)]' : 'border-[#414940]'} overflow-hidden flex items-center justify-center text-lg`}
          style={{ backgroundColor: color }}
        >
          {emoji}
        </div>
        {isDealer && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white text-black font-bold text-[7px] flex items-center justify-center">
            D
          </div>
        )}
      </div>

      {/* Cards + Info */}
      <div className="flex flex-col items-start gap-0.5">
        {/* Cards row */}
        {!isFolded && (
          <div className="flex gap-0.5">
            <PlayingCard card={cards?.[0] ?? null} small />
            <PlayingCard card={cards?.[1] ?? null} small />
          </div>
        )}

        {/* Name + chips */}
        <div className="bg-black/60 px-2 py-0.5 rounded-full flex items-center gap-1.5 min-w-[60px]">
          <span className="text-[8px] font-bold text-white/50 uppercase tracking-tight truncate max-w-[50px]">
            {player.nickname}
          </span>
          <span className="text-[10px] font-headline font-bold text-[#e9c349]">
            {player.chips.toLocaleString()}
          </span>
        </div>

        {/* Thinking indicator */}
        {isCurrentTurn && !isFolded && (
          <div className="bg-[#96d59b] text-[#131313] text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">
            Thinking
          </div>
        )}
      </div>
    </div>
  )
}
