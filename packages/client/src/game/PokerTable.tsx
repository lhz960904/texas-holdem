import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/game-store'
import { SettleOverlay } from '../components/SettleOverlay'
import { PlayingCard } from './PlayingCard'
import { PlayerSeat } from './PlayerSeat'
import { ChipPile } from './ChipPile'
import type { Card } from '@texas-holdem/shared'

// Opponent seat positions (self is NOT on the table)
// Positions are CSS percentages for absolute placement on the table container
const OPPONENT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  1: [
    { top: '8%', left: '50%' },
  ],
  2: [
    { top: '15%', left: '25%' },
    { top: '15%', left: '75%' },
  ],
  3: [
    { top: '15%', left: '20%' },
    { top: '8%', left: '50%' },
    { top: '15%', left: '80%' },
  ],
  4: [
    { top: '45%', left: '5%' },
    { top: '8%', left: '30%' },
    { top: '8%', left: '70%' },
    { top: '45%', left: '95%' },
  ],
  5: [
    { top: '50%', left: '5%' },
    { top: '12%', left: '15%' },
    { top: '8%', left: '50%' },
    { top: '12%', left: '85%' },
    { top: '50%', left: '95%' },
  ],
  6: [
    { top: '55%', left: '5%' },
    { top: '20%', left: '10%' },
    { top: '8%', left: '40%' },
    { top: '8%', left: '60%' },
    { top: '20%', left: '90%' },
    { top: '55%', left: '95%' },
  ],
  7: [
    { top: '60%', left: '5%' },
    { top: '30%', left: '5%' },
    { top: '8%', left: '25%' },
    { top: '8%', left: '50%' },
    { top: '8%', left: '75%' },
    { top: '30%', left: '95%' },
    { top: '60%', left: '95%' },
  ],
}

function getOpponentPositions(
  mySeatIndex: number,
  allSeatIndices: number[]
): { seatIndex: number; position: { top: string; left: string } }[] {
  // Remove self, keep order starting from the seat after mine
  const myIdx = allSeatIndices.indexOf(mySeatIndex)
  const opponents: number[] = []
  for (let i = 1; i < allSeatIndices.length; i++) {
    opponents.push(allSeatIndices[(myIdx + i) % allSeatIndices.length])
  }
  const positions = OPPONENT_POSITIONS[opponents.length] ?? OPPONENT_POSITIONS[7]!
  return opponents.map((seatIndex, i) => ({
    seatIndex,
    position: positions[i] ?? positions[positions.length - 1],
  }))
}

// Self position for bet chip calculation (bottom center, off-table)
const SELF_POSITION = { top: '90%', left: '50%' }

// Calculate bet chip position: lerp from player toward center
function getBetPosition(playerPos: { top: string; left: string }): { top: string; left: string } {
  const pTop = parseFloat(playerPos.top) / 100
  const pLeft = parseFloat(playerPos.left) / 100
  const cTop = 0.42
  const cLeft = 0.50
  const t = 0.4
  return {
    top: `${((pTop + (cTop - pTop) * t) * 100).toFixed(1)}%`,
    left: `${((pLeft + (cLeft - pLeft) * t) * 100).toFixed(1)}%`,
  }
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
  const lastAction = useGameStore((s) => s.lastAction)
  const potCollectTarget = useGameStore((s) => s.potCollectTarget)
  const sendAction = useGameStore((s) => s.sendAction)
  const currentBet = useGameStore((s) => s.currentBet)
  const minRaise = useGameStore((s) => s.minRaise)
  const hands = useGameStore((s) => s.hands)

  const [now, setNow] = useState(Date.now())
  const [betAnimations, setBetAnimations] = useState<Map<number, boolean>>(new Map())
  const [potCollecting, setPotCollecting] = useState<{ seatIndex: number } | null>(null)
  const betAnimTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const [raiseAmount, setRaiseAmount] = useState(minRaise)

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

  // Sync raise amount when minRaise changes
  useEffect(() => {
    setRaiseAmount(minRaise)
  }, [minRaise])

  // Bet push-in animation on player-action
  useEffect(() => {
    if (lastAction && lastAction.type !== 'fold' && lastAction.type !== 'check') {
      const seat = lastAction.seatIndex
      setBetAnimations((prev) => new Map(prev).set(seat, true))
      const existing = betAnimTimeouts.current.get(seat)
      if (existing) clearTimeout(existing)
      const timeout = setTimeout(() => {
        setBetAnimations((prev) => {
          const next = new Map(prev)
          next.delete(seat)
          return next
        })
      }, 400)
      betAnimTimeouts.current.set(seat, timeout)
    }
  }, [lastAction])

  // Pot collect animation on settle
  useEffect(() => {
    if (potCollectTarget !== null) {
      setPotCollecting({ seatIndex: potCollectTarget })
      const timeout = setTimeout(() => {
        setPotCollecting(null)
      }, 800)
      return () => clearTimeout(timeout)
    }
    setPotCollecting(null)
    return undefined
  }, [potCollectTarget])

  const me = room?.players.find((p) => p.id === playerId)
  const mySeatIndex = me?.seatIndex ?? 0
  const myChips = me?.chips ?? 0

  // Build hands map
  const handsMap = new Map<number, { bet: number; cards?: [Card, Card] | null }>()
  if (Array.isArray(handsArr)) {
    for (const h of handsArr) {
      handsMap.set(h.seatIndex, { bet: h.bet, cards: h.cards ?? null })
    }
  }
  if (showdownResults && showdownResults.length > 0) {
    for (const r of showdownResults) {
      const existing = handsMap.get(r.seatIndex)
      handsMap.set(r.seatIndex, { bet: existing?.bet ?? 0, cards: r.cards })
    }
  }
  if (revealedCards.size > 0) {
    for (const [seatIdx, cards] of revealedCards) {
      const existing = handsMap.get(seatIdx)
      handsMap.set(seatIdx, { bet: existing?.bet ?? 0, cards })
    }
  }

  const players = room?.players ?? []
  const allSeatIndices = players.map((p) => p.seatIndex).sort((a, b) => a - b)
  const opponentMap = getOpponentPositions(mySeatIndex, allSeatIndices)

  // Build full seat-to-position map for chip piles (including self)
  const seatPositionMap = new Map<number, { top: string; left: string }>()
  seatPositionMap.set(mySeatIndex, SELF_POSITION)
  for (const { seatIndex, position } of opponentMap) {
    seatPositionMap.set(seatIndex, position)
  }

  const communityCards = room?.game?.communityCards ?? []
  const pot = room?.game?.pot ?? 0
  const phase = room?.game?.phase
  const dealerSeat = room?.game?.dealerSeat

  // Action bar logic
  const isMyTurn = currentTurn === mySeatIndex
  const myHand = Array.isArray(hands) ? hands.find((h) => h.seatIndex === mySeatIndex) : undefined
  const myBet = myHand?.bet ?? 0
  const canCheck = currentBet === myBet
  const callAmount = Math.min(currentBet - myBet, myChips)
  const effectiveMinRaise = Math.max(minRaise, currentBet - myBet + 1)
  const effectiveRaise = Math.max(raiseAmount, effectiveMinRaise)
  const halfPot = Math.max(effectiveMinRaise, Math.floor(pot / 2))
  const fullPot = Math.max(effectiveMinRaise, pot)

  const handleRaise = () => sendAction('raise', effectiveRaise)
  const handleAllIn = () => sendAction('allIn', myChips)

  // Parse my avatar
  const myAvatarParts = (me?.avatar ?? '👤:#888888').split(':')
  const myEmoji = myAvatarParts[0] || '👤'
  const myColor = myAvatarParts[1] || '#888888'

  return (
    <div className="fixed inset-0 bg-[#131313] flex flex-col">
      {/* Table area */}
      <div className="relative flex-1 flex items-center justify-center p-4 pt-2 pb-0">
        {/* Table container — rounded racetrack shape */}
        <div className="relative w-full max-w-5xl" style={{ aspectRatio: '2.2/1' }}>
          {/* Outer border */}
          <div className="absolute inset-0 rounded-[200px] border-[12px] border-[#2a2a2a] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Golden inner border */}
            <div className="absolute inset-0 border-[3px] border-primary/40 rounded-[190px] pointer-events-none z-10" />
            {/* Felt surface */}
            <div className="absolute inset-0 poker-felt">
              {/* Pot display */}
              {pot > 0 && (
                <div className="absolute top-[36%] left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-5 py-2 rounded-full border border-[#e9c349]/20">
                    <span className="font-headline font-extrabold text-2xl text-[#e9c349] tracking-tighter">
                      POT: {pot.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Community cards */}
              <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2 z-10">
                {Array.from({ length: 5 }).map((_, i) => {
                  const card = communityCards[i] ?? null
                  const isDealt = i < communityCards.length
                  return (
                    <div key={i}>
                      {isDealt ? (
                        <PlayingCard card={card} animationDelay={i * 80} />
                      ) : (
                        <div className="w-16 h-24 rounded-lg border border-white/8 bg-white/3" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Phase label */}
              {phase && phase !== 'waiting' && (
                <div className="absolute top-[62%] left-1/2 -translate-x-1/2 z-10">
                  <span className="text-[10px] uppercase font-medium text-white/35 tracking-[0.15em]">
                    {phase}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bet chip piles */}
          {[...seatPositionMap.entries()].map(([seatIndex, position]) => {
            const hand = handsMap.get(seatIndex)
            const bet = hand?.bet ?? 0
            if (bet <= 0) return null
            const betPos = getBetPosition(position)
            const isAnimating = betAnimations.get(seatIndex) ?? false
            const pTop = parseFloat(position.top)
            const pLeft = parseFloat(position.left)
            const bTop = parseFloat(betPos.top)
            const bLeft = parseFloat(betPos.left)
            const pushFrom = {
              x: (pLeft - bLeft) * 3,
              y: (pTop - bTop) * 3,
            }
            return (
              <ChipPile
                key={`bet-${seatIndex}`}
                amount={bet}
                seatIndex={seatIndex}
                animate={isAnimating ? 'push-in' : null}
                pushFrom={pushFrom}
                position={{ x: betPos.left, y: betPos.top }}
              />
            )
          })}

          {/* Opponent seats */}
          {opponentMap.map(({ seatIndex, position }) => {
            const player = players.find((p) => p.seatIndex === seatIndex)
            if (!player) return null
            const hand = handsMap.get(seatIndex)
            const cards: [Card, Card] | null = (hand?.cards as [Card, Card]) ?? null

            return (
              <PlayerSeat
                key={seatIndex}
                player={player}
                isCurrentTurn={currentTurn === seatIndex}
                cards={cards}
                bet={hand?.bet ?? 0}
                isDealer={dealerSeat === seatIndex}
                style={{ top: position.top, left: position.left }}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="bg-[#131313]/90 backdrop-blur-xl border-t border-white/10 px-6 pb-6 pt-3">
        <div className="max-w-5xl mx-auto flex items-end justify-between gap-6">
          {/* Left: My avatar + my cards + hand rank */}
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 rounded-full border-4 border-[#e9c349] flex items-center justify-center text-4xl overflow-hidden"
                style={{ backgroundColor: myColor }}
              >
                {myEmoji}
              </div>
              <div className="absolute -top-1 -right-1 bg-[#e9c349] text-[#131313] text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                YOU
              </div>
              {dealerSeat === mySeatIndex && (
                <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-white text-black font-bold text-[10px] flex items-center justify-center">
                  D
                </div>
              )}
            </div>

            {/* My cards */}
            {myCards && (
              <div className="flex items-end -ml-2">
                <div style={{ transform: 'rotate(-5deg)' }} className="hover:-translate-y-2 transition-transform">
                  <PlayingCard card={myCards[0]} large />
                </div>
                <div style={{ transform: 'rotate(5deg)' }} className="-ml-6 hover:-translate-y-2 transition-transform">
                  <PlayingCard card={myCards[1]} large />
                </div>
              </div>
            )}

            {/* Chips display */}
            <div className="pb-2">
              <div className="text-[10px] text-white/50 uppercase tracking-tight">{me?.nickname}</div>
              <div className="font-headline font-bold text-[#e9c349] text-lg">
                {myChips.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Center: Action buttons */}
          <div className="flex gap-2 items-end pb-2">
            <button
              onClick={() => sendAction('fold')}
              disabled={!isMyTurn}
              className="h-14 px-6 rounded-xl bg-[#2a2a2a] text-[#e5e2e1] font-headline font-extrabold text-lg uppercase hover:bg-[#3a3a3a] transition-colors disabled:opacity-30"
            >
              Fold
            </button>

            {canCheck ? (
              <button
                onClick={() => sendAction('check')}
                disabled={!isMyTurn}
                className="h-14 px-6 rounded-xl border-2 border-[#96d59b] text-[#96d59b] font-headline font-extrabold text-lg uppercase hover:bg-[#96d59b]/10 transition-colors disabled:opacity-30"
              >
                Check
              </button>
            ) : callAmount > 0 ? (
              <button
                onClick={() => sendAction('call')}
                disabled={!isMyTurn}
                className="h-14 px-6 rounded-xl border-2 border-[#96d59b] text-[#96d59b] font-headline font-extrabold text-lg uppercase hover:bg-[#96d59b]/10 transition-colors disabled:opacity-30"
              >
                <span className="block leading-tight">Call</span>
                <span className="block text-xs opacity-80">{callAmount.toLocaleString()}</span>
              </button>
            ) : null}

            <button
              onClick={handleRaise}
              disabled={!isMyTurn || myChips <= callAmount}
              className="h-14 px-6 rounded-xl bg-gradient-to-b from-[#e9c349] to-[#c4a033] text-[#131313] font-headline font-extrabold text-lg uppercase hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <span className="block leading-tight">Raise</span>
              <span className="block text-xs opacity-80">{effectiveRaise.toLocaleString()}</span>
            </button>

            <button
              onClick={handleAllIn}
              disabled={!isMyTurn}
              className="h-14 px-6 rounded-xl border-2 border-[#e9c349] text-[#e9c349] font-headline font-extrabold text-lg uppercase hover:bg-[#e9c349]/10 transition-colors disabled:opacity-30"
            >
              <span className="block leading-tight">All In</span>
              <span className="block text-xs opacity-80">{myChips.toLocaleString()}</span>
            </button>
          </div>

          {/* Right: Raise slider */}
          {isMyTurn && (
            <div className="flex flex-col gap-2 min-w-[160px] pb-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/70">Raise</span>
                <span className="text-[#e9c349] font-headline font-bold">{effectiveRaise.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={effectiveMinRaise}
                max={myChips}
                value={effectiveRaise}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-full accent-[#e9c349] h-2 rounded-full"
              />
              <div className="flex gap-1.5">
                {[
                  { label: '½ Pot', value: halfPot },
                  { label: 'Pot', value: fullPot },
                  { label: 'Max', value: myChips },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => setRaiseAmount(value)}
                    className="flex-1 py-1 text-[10px] font-bold rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors uppercase"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settle overlay */}
      {settleWinners.length > 0 && <SettleOverlay />}
    </div>
  )
}
