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
      className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${isFolded ? 'opacity-40' : ''}`}
      style={style}
    >
      {/* Cards */}
      <div className="flex gap-0.5 mb-1">
        {isMe && cards ? (
          <>
            <PlayingCard card={cards[0]} small />
            <PlayingCard card={cards[1]} small />
          </>
        ) : cards ? (
          <>
            <PlayingCard card={cards[0]} small />
            <PlayingCard card={cards[1]} small />
          </>
        ) : !isFolded ? (
          <>
            <PlayingCard card={null} small />
            <PlayingCard card={null} small />
          </>
        ) : null}
      </div>

      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg ${
          isCurrentTurn ? 'ring-2 ring-yellow-400 animate-pulse' : ''
        }`}
        style={{ backgroundColor: color }}
      >
        {emoji}
      </div>

      {/* Name + Chips */}
      <div className="mt-0.5 text-center">
        <div className="text-white text-[10px] font-semibold truncate max-w-[64px] leading-tight">
          {player.nickname}
          {isMe && <span className="text-yellow-400 ml-0.5">(我)</span>}
        </div>
        <div className="text-yellow-300 text-[10px] font-bold leading-tight">
          {player.chips.toLocaleString()}
        </div>
      </div>

      {/* Timer bar */}
      {isCurrentTurn && (
        <div className="w-12 h-1 bg-white/20 rounded-full mt-0.5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${timerProgress * 100}%`,
              backgroundColor: timerColor,
              transition: 'width 1s linear, background-color 0.5s',
            }}
          />
        </div>
      )}

      {/* Bet display */}
      {bet > 0 && (
        <div className="mt-0.5 px-1.5 py-0.5 rounded-full bg-black/60 border border-yellow-500/40">
          <span className="text-yellow-400 text-[10px] font-bold">{bet.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
