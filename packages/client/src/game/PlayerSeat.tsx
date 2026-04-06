import type { Card, PlayerInfo } from '@texas-holdem/shared'
import { PlayingCard } from './PlayingCard'

interface PlayerSeatProps {
  player: PlayerInfo
  isCurrentTurn: boolean
  cards: [Card, Card] | null
  bet: number
  isDealer: boolean
  side?: 'left' | 'right' | 'top' // right side = reverse order (cards first, avatar after)
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
  side = 'top',
  style,
}: PlayerSeatProps) {
  const { emoji, color } = parseAvatar(player.avatar)
  const isFolded = player.status === 'folded'
  const isRight = side === 'right'

  const avatarEl = (
    <div className="relative flex-shrink-0">
      <div
        className={`w-8 h-8 rounded-full border-2 ${isCurrentTurn ? 'border-[#96d59b] shadow-[0_0_10px_rgba(150,213,155,0.4)]' : 'border-[#414940]'} overflow-hidden flex items-center justify-center text-base`}
        style={{ backgroundColor: color }}
      >
        {emoji}
      </div>
      {isDealer && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white text-black font-bold text-[6px] flex items-center justify-center">D</div>
      )}
    </div>
  )

  const cardsAndInfo = (
    <div className={`flex flex-col ${isRight ? 'items-end' : 'items-start'} gap-0.5`}>
      {!isFolded && (
        <div className="flex gap-px">
          <PlayingCard card={cards?.[0] ?? null} small className="!w-9 !h-[52px] !rounded !text-[10px]" />
          <PlayingCard card={cards?.[1] ?? null} small className="!w-9 !h-[52px] !rounded !text-[10px]" />
        </div>
      )}
      <div className="bg-black/60 px-1.5 py-0.5 rounded-full flex items-center gap-1 min-w-[50px]">
        <span className="text-[7px] font-bold text-white/50 uppercase tracking-tight truncate max-w-[40px]">
          {player.nickname}
        </span>
        <span className="text-[9px] font-headline font-bold text-[#e9c349]">
          {player.chips.toLocaleString()}
        </span>
      </div>
      {isCurrentTurn && !isFolded && (
        <div className="bg-[#96d59b] text-[#131313] text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase">Thinking</div>
      )}
    </div>
  )

  return (
    <div
      data-testid="player-seat"
      data-seat={player.seatIndex}
      className={`absolute flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 ${isFolded ? 'grayscale opacity-40' : ''}`}
      style={{ ...style, transition: 'opacity 0.5s ease, filter 0.5s ease' }}
    >
      {isRight ? (
        <>{cardsAndInfo}{avatarEl}</>
      ) : (
        <>{avatarEl}{cardsAndInfo}</>
      )}
    </div>
  )
}
