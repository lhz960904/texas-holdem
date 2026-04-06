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
      className="fixed inset-0 bg-[#0d1f15] flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Table area */}
      <div className="relative flex-1" style={{ height: '75%' }}>
        {/* Green felt table */}
        <div
          className="absolute"
          style={{
            top: '8%',
            left: '8%',
            right: '8%',
            bottom: '4%',
            background: 'radial-gradient(ellipse, #2a7a4a 0%, #1a5a32 60%, #124a28 100%)',
            borderRadius: '50%',
            border: '4px solid #8b7355',
            boxShadow: '0 0 0 8px rgba(60,40,20,0.6), 0 0 40px rgba(0,0,0,0.5)',
          }}
        />

        {/* Pot display */}
        {pot > 0 && (
          <div className="absolute top-[32%] left-1/2 -translate-x-1/2 z-10">
            <div className="px-3 py-1 rounded-full bg-black/50 border border-yellow-500/30">
              <span className="text-yellow-400 text-xs font-bold">
                底池 {pot.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Community cards */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {Array.from({ length: 5 }).map((_, i) => {
            const card = communityCards[i] ?? null
            const isDealt = i < communityCards.length
            return (
              <div key={i} style={isDealt ? { animation: 'dealCard 0.3s ease-out' } : undefined}>
                {isDealt ? (
                  <PlayingCard card={card} />
                ) : (
                  <div className="w-9 h-13 rounded-md border border-white/10 bg-white/5" />
                )}
              </div>
            )
          })}
        </div>

        {/* Phase indicator */}
        {phase && phase !== 'waiting' && (
          <div className="absolute top-[56%] left-1/2 -translate-x-1/2 z-10">
            <span className="text-white/40 text-[10px] uppercase tracking-wider">{phase}</span>
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

      {/* Global keyframes */}
      <style>{`
        @keyframes dealCard {
          from { transform: translateY(-100px) scale(0.5); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
