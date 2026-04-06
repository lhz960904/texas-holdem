import type { Card, PlayerInfo } from '@texas-holdem/shared'
import { PlayingCard } from './PlayingCard'

interface PlayerSeatProps {
  player: PlayerInfo
  isCurrentTurn: boolean
  cards: [Card, Card] | null
  bet: number
  isDealer: boolean
  timerProgress: number // 0-1, 1 = full time remaining
  side?: 'left' | 'right' | 'top'
  style: React.CSSProperties
  isSpeaking?: boolean
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
  timerProgress,
  side = 'top',
  style,
  isSpeaking = false,
}: PlayerSeatProps) {
  const { emoji, color } = parseAvatar(player.avatar)
  const isFolded = player.status === 'folded'
  const isRight = side === 'right'

  const size = 36 // avatar size in px
  const strokeWidth = 3
  const radius = (size + strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * (size / 2)
  const dashOffset = circumference * (1 - timerProgress)

  // Timer ring color: green > yellow > red
  const ringColor = timerProgress > 0.5 ? '#96d59b' : timerProgress > 0.2 ? '#e9c349' : '#ef4444'

  const avatarEl = (
    <div className="relative flex-shrink-0" style={{ width: size + strokeWidth * 2, height: size + strokeWidth * 2 }}>
      {/* Countdown ring (SVG) */}
      {isCurrentTurn && !isFolded && (
        <svg
          className="absolute inset-0"
          width={size + strokeWidth * 2}
          height={size + strokeWidth * 2}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track */}
          <circle
            cx={radius} cy={radius} r={size / 2}
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth}
          />
          {/* Progress arc — shrinks over time */}
          <circle
            cx={radius} cy={radius} r={size / 2}
            fill="none" stroke={ringColor} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
          />
        </svg>
      )}

      {/* Speaking glow ring */}
      {isSpeaking && (
        <div
          className="absolute rounded-full animate-[speakPulse_1s_ease-in-out_infinite]"
          style={{
            width: size + strokeWidth * 2 + 6,
            height: size + strokeWidth * 2 + 6,
            top: -3, left: -3,
            border: '2px solid #4ade80',
            boxShadow: '0 0 12px rgba(74,222,128,0.6), 0 0 24px rgba(74,222,128,0.3)',
          }}
        />
      )}
      {/* Avatar circle */}
      <div
        className={`absolute rounded-full border-2 ${isSpeaking ? 'border-[#4ade80]' : !isCurrentTurn ? 'border-[#414940]' : 'border-transparent'} overflow-hidden flex items-center justify-center text-base`}
        style={{
          backgroundColor: color,
          width: size, height: size,
          top: strokeWidth, left: strokeWidth,
        }}
      >
        {emoji}
      </div>
      {isDealer && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white text-black font-bold text-[6px] flex items-center justify-center z-10">D</div>
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
    </div>
  )

  return (
    <div
      data-testid="player-seat"
      data-seat={player.seatIndex}
      className={`absolute z-15 flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 ${isFolded ? 'grayscale opacity-40' : ''}`}
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
