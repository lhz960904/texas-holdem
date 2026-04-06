import type { Card, PlayerInfo } from '@texas-holdem/shared'
import { PlayingCard } from './PlayingCard'

interface PlayerSeatProps {
  player: PlayerInfo
  isMe: boolean
  isCurrentTurn: boolean
  cards: [Card, Card] | null // null = face down for opponents
  bet: number
  timerProgress: number // 0-1
  style: React.CSSProperties // for absolute positioning
}

function parseAvatar(avatar: string): { emoji: string; color: string } {
  const parts = avatar.split(':')
  return { emoji: parts[0] || '👤', color: parts[1] || '#888888' }
}

export function PlayerSeat({
  player,
  isMe,
  isCurrentTurn,
  cards,
  bet,
  timerProgress,
  style,
}: PlayerSeatProps) {
  const { emoji, color } = parseAvatar(player.avatar)
  const isFolded = player.status === 'folded'

  // Timer bar color: green -> yellow -> red
  const timerColor =
    timerProgress > 0.5 ? '#22c55e' : timerProgress > 0.2 ? '#eab308' : '#ef4444'

  return (
    <div
      data-testid="player-seat"
      data-seat={player.seatIndex}
      className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2`}
      style={{
        ...style,
        opacity: isFolded ? 0.35 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Cards — above avatar with slight rotation for realism */}
      <div className="flex gap-0.5 mb-1" style={{ perspective: '200px' }}>
        {isMe && cards ? (
          <>
            <div style={{ transform: 'rotate(-3deg)' }}>
              <PlayingCard card={cards[0]} small />
            </div>
            <div style={{ transform: 'rotate(3deg)' }}>
              <PlayingCard card={cards[1]} small />
            </div>
          </>
        ) : cards ? (
          <>
            <div style={{ transform: 'rotate(-3deg)' }}>
              <PlayingCard card={cards[0]} small />
            </div>
            <div style={{ transform: 'rotate(3deg)' }}>
              <PlayingCard card={cards[1]} small />
            </div>
          </>
        ) : !isFolded ? (
          <>
            <div style={{ transform: 'rotate(-3deg)' }}>
              <PlayingCard card={null} small />
            </div>
            <div style={{ transform: 'rotate(3deg)' }}>
              <PlayingCard card={null} small />
            </div>
          </>
        ) : null}
      </div>

      {/* Avatar — 40x40px with premium border for active player */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
        style={{
          backgroundColor: color,
          boxShadow: isCurrentTurn
            ? '0 0 0 3px #ffd700, 0 0 20px rgba(255,215,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.4)',
          animation: isCurrentTurn ? 'pulseRing 2s ease-in-out infinite' : undefined,
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {emoji}
      </div>

      {/* Name + Chips */}
      <div className="mt-0.5 text-center">
        <div
          className="text-[10px] font-semibold truncate max-w-[64px] leading-tight"
          style={{
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          {player.nickname}
          {isMe && <span style={{ color: '#ffd700', marginLeft: '2px' }}>(我)</span>}
        </div>
        <div
          className="text-[10px] font-bold leading-tight"
          style={{
            color: '#ffd700',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {player.chips.toLocaleString()}
        </div>
      </div>

      {/* Timer bar — 40px wide, 3px height, gradient green→yellow→red */}
      {isCurrentTurn && (
        <div
          className="h-[3px] rounded-full mt-0.5 overflow-hidden"
          style={{
            width: '40px',
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${timerProgress * 100}%`,
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor})`,
              transition: 'width 1s linear, background-color 0.5s',
            }}
          />
        </div>
      )}

      {/* Bet is now shown as scattered chips on the table via ChipPile */}
    </div>
  )
}
