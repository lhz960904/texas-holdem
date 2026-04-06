import { useEffect, useState, useCallback } from 'react'
import { useGameStore } from '../stores/game-store'
import { ActionBar } from '../components/ActionBar'
import { SettleOverlay } from '../components/SettleOverlay'
import { PlayingCard } from './PlayingCard'
import { PlayerSeat } from './PlayerSeat'
import type { Card } from '@texas-holdem/shared'

// Seat positions as CSS percentages, indexed by player count
// Position 0 is always self (bottom center)
const SEAT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  2: [
    { top: '80%', left: '50%' },
    { top: '8%', left: '50%' },
  ],
  3: [
    { top: '80%', left: '50%' },
    { top: '15%', left: '20%' },
    { top: '15%', left: '80%' },
  ],
  4: [
    { top: '80%', left: '50%' },
    { top: '45%', left: '5%' },
    { top: '8%', left: '50%' },
    { top: '45%', left: '95%' },
  ],
  5: [
    { top: '80%', left: '50%' },
    { top: '60%', left: '5%' },
    { top: '15%', left: '18%' },
    { top: '15%', left: '82%' },
    { top: '60%', left: '95%' },
  ],
  6: [
    { top: '80%', left: '50%' },
    { top: '60%', left: '5%' },
    { top: '15%', left: '12%' },
    { top: '8%', left: '50%' },
    { top: '15%', left: '88%' },
    { top: '60%', left: '95%' },
  ],
  7: [
    { top: '80%', left: '50%' },
    { top: '65%', left: '5%' },
    { top: '30%', left: '5%' },
    { top: '8%', left: '30%' },
    { top: '8%', left: '70%' },
    { top: '30%', left: '95%' },
    { top: '65%', left: '95%' },
  ],
  8: [
    { top: '80%', left: '50%' },
    { top: '65%', left: '5%' },
    { top: '30%', left: '5%' },
    { top: '8%', left: '25%' },
    { top: '8%', left: '50%' },
    { top: '8%', left: '75%' },
    { top: '30%', left: '95%' },
    { top: '65%', left: '95%' },
  ],
}

function getRotatedPositions(
  playerCount: number,
  mySeatIndex: number,
  allSeatIndices: number[]
): { seatIndex: number; position: { top: string; left: string } }[] {
  const positions = SEAT_POSITIONS[playerCount] ?? SEAT_POSITIONS[8]!
  // Sort seats so mySeatIndex is first
  const myIdx = allSeatIndices.indexOf(mySeatIndex)
  const rotated: number[] = []
  for (let i = 0; i < allSeatIndices.length; i++) {
    rotated.push(allSeatIndices[(myIdx + i) % allSeatIndices.length])
  }
  return rotated.map((seatIndex, i) => ({
    seatIndex,
    position: positions[i] ?? positions[positions.length - 1],
  }))
}

// Chip denomination definitions for stacked chip visualization
const CHIP_DENOMINATIONS = [
  { value: 1000, color: 'linear-gradient(135deg, #ffd700, #ff8c00)', borderColor: 'rgba(255,255,255,0.5)', textColor: '#000' },
  { value: 100, color: '#2c3e50', borderColor: 'rgba(255,255,255,0.4)', textColor: '#fff' },
  { value: 25, color: '#27ae60', borderColor: 'rgba(255,255,255,0.4)', textColor: '#fff' },
  { value: 5, color: '#c0392b', borderColor: 'rgba(255,255,255,0.4)', textColor: '#fff' },
]

interface ChipInfo {
  color: string
  borderColor: string
  textColor: string
  value: number
}

function ChipStack({ amount }: { amount: number }) {
  const chips: ChipInfo[] = []
  let remaining = amount

  for (const d of CHIP_DENOMINATIONS) {
    const count = Math.min(Math.floor(remaining / d.value), 3) // max 3 per denomination
    for (let i = 0; i < count; i++) {
      chips.push({ color: d.color, borderColor: d.borderColor, textColor: d.textColor, value: d.value })
    }
    remaining -= count * d.value
  }

  // Ensure at least one chip visual if amount > 0
  if (chips.length === 0 && amount > 0) {
    const last = CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length - 1]
    chips.push({ color: last.color, borderColor: last.borderColor, textColor: last.textColor, value: last.value })
  }

  return (
    <div className="flex flex-col items-center" style={{ animation: 'chipSlide 0.4s ease-out' }}>
      {/* Stacked chips */}
      <div className="relative" style={{ height: `${Math.max(28, chips.length * 3 + 25)}px`, width: '28px' }}>
        {chips.map((chip, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: '28px',
              height: '28px',
              bottom: `${i * 3}px`,
              background: chip.color,
              border: `2px dashed ${chip.borderColor}`,
              boxShadow: `
                0 2px 0 rgba(0,0,0,0.3),
                0 3px 0 rgba(0,0,0,0.2),
                inset 0 1px 0 rgba(255,255,255,0.2)
              `,
            }}
          />
        ))}
      </div>
      {/* Amount text below */}
      <div
        className="text-xs font-bold mt-1 px-2 py-0.5 rounded-full"
        style={{
          color: '#ffd700',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,215,0,0.3)',
        }}
      >
        {amount.toLocaleString()}
      </div>
    </div>
  )
}

export function PokerTable() {
  const room = useGameStore((s) => s.room)
  const myCards = useGameStore((s) => s.myCards)
  const currentTurn = useGameStore((s) => s.currentTurn)
  const turnDeadline = useGameStore((s) => s.turnDeadline)
  const handsArr = useGameStore((s) => s.hands)
  const playerId = useGameStore((s) => s.playerId)
  const settleWinners = useGameStore((s) => s.settleWinners)
  const showdownResults = useGameStore((s) => s.showdownResults)
  const revealedCards = useGameStore((s) => s.revealedCards)

  const [now, setNow] = useState(Date.now())

  // Lock landscape
  useEffect(() => {
    try {
      ;(screen.orientation as any)?.lock?.('landscape').catch(() => {})
    } catch {}
  }, [])

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [])

  const me = room?.players.find((p) => p.id === playerId)
  const mySeatIndex = me?.seatIndex ?? 0

  // Build hands map for bet + cards lookup
  const handsMap = new Map<number, { bet: number; cards?: [Card, Card] | null }>()
  if (Array.isArray(handsArr)) {
    for (const h of handsArr) {
      handsMap.set(h.seatIndex, { bet: h.bet, cards: h.cards ?? null })
    }
  }
  // Overlay showdown results (revealed cards)
  if (showdownResults && showdownResults.length > 0) {
    for (const r of showdownResults) {
      const existing = handsMap.get(r.seatIndex)
      handsMap.set(r.seatIndex, { bet: existing?.bet ?? 0, cards: r.cards })
    }
  }
  // Overlay revealed cards
  if (revealedCards.size > 0) {
    for (const [seatIdx, cards] of revealedCards) {
      const existing = handsMap.get(seatIdx)
      handsMap.set(seatIdx, { bet: existing?.bet ?? 0, cards })
    }
  }

  const players = room?.players ?? []
  const allSeatIndices = players.map((p) => p.seatIndex).sort((a, b) => a - b)
  const seatMap = getRotatedPositions(players.length, mySeatIndex, allSeatIndices)

  const communityCards = room?.game?.communityCards ?? []
  const pot = room?.game?.pot ?? 0
  const phase = room?.game?.phase

  // Compute timer progress for current turn player
  const getTimerProgress = useCallback(
    (seatIndex: number): number => {
      if (currentTurn !== seatIndex || !turnDeadline) return 0
      const totalTime = room?.config.turnTime ?? 30
      const remaining = Math.max(0, (turnDeadline - now) / 1000)
      return Math.min(1, remaining / totalTime)
    },
    [currentTurn, turnDeadline, now, room?.config.turnTime]
  )

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        backgroundColor: '#080f08',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Table area */}
      <div className="relative flex-1" style={{ height: '75%' }}>
        {/* Premium emerald green felt table */}
        <div
          className="absolute"
          style={{
            top: '8%',
            left: '8%',
            right: '8%',
            bottom: '4%',
            background: `
              radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 60%),
              radial-gradient(ellipse at center, #1e6b3a 0%, #145228 50%, #0d3a1c 100%)
            `,
            borderRadius: '50%',
            border: '10px solid #3a2510',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4), 0 0 0 4px #2a1a08, 0 0 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Inner decorative ring */}
          <div
            className="absolute inset-3 rounded-[50%] pointer-events-none"
            style={{
              border: '1.5px solid rgba(255,255,255,0.06)',
            }}
          />
          {/* Subtle felt noise texture */}
          <div
            className="absolute inset-0 rounded-[50%] pointer-events-none"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  rgba(255,255,255,0.015),
                  rgba(255,255,255,0.015) 1px,
                  transparent 1px,
                  transparent 3px
                ),
                repeating-linear-gradient(
                  90deg,
                  rgba(255,255,255,0.015),
                  rgba(255,255,255,0.015) 1px,
                  transparent 1px,
                  transparent 3px
                )
              `,
              opacity: 0.03,
            }}
          />
        </div>

        {/* Pot display — stacked chips visualization */}
        {pot > 0 && (
          <div className="absolute top-[28%] left-1/2 -translate-x-1/2 z-10">
            <ChipStack amount={pot} />
          </div>
        )}

        {/* Community cards with staggered deal animation */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {Array.from({ length: 5 }).map((_, i) => {
            const card = communityCards[i] ?? null
            const isDealt = i < communityCards.length
            return (
              <div key={i}>
                {isDealt ? (
                  <PlayingCard card={card} animationDelay={i * 80} />
                ) : (
                  <div
                    className="w-11 h-16 rounded-[6px]"
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Phase indicator — small, translucent, uppercase tracking */}
        {phase && phase !== 'waiting' && (
          <div className="absolute top-[58%] left-1/2 -translate-x-1/2 z-10">
            <span
              className="text-[10px] uppercase font-medium"
              style={{
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.15em',
              }}
            >
              {phase}
            </span>
          </div>
        )}

        {/* Player seats */}
        {seatMap.map(({ seatIndex, position }) => {
          const player = players.find((p) => p.seatIndex === seatIndex)
          if (!player) return null
          const isMe = player.id === playerId
          const hand = handsMap.get(seatIndex)
          const cards: [Card, Card] | null = isMe
            ? myCards ?? null
            : (hand?.cards as [Card, Card]) ?? null

          return (
            <PlayerSeat
              key={seatIndex}
              player={player}
              isMe={isMe}
              isCurrentTurn={currentTurn === seatIndex}
              cards={cards}
              bet={hand?.bet ?? 0}
              timerProgress={getTimerProgress(seatIndex)}
              style={{ top: position.top, left: position.left }}
            />
          )
        })}
      </div>

      {/* Action bar */}
      <ActionBar mySeatIndex={mySeatIndex} />

      {/* Settle overlay */}
      {settleWinners.length > 0 && <SettleOverlay />}
    </div>
  )
}
