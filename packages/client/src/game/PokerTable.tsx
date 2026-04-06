import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/game-store'
import { SettleOverlay } from '../components/SettleOverlay'
import { PlayingCard } from './PlayingCard'
import { PlayerSeat } from './PlayerSeat'
import { ChipPile } from './ChipPile'
import type { Card } from '@texas-holdem/shared'

// Opponent seat positions (self is NOT on the table)
// Positions are CSS percentages for absolute placement on the table container
// Opponent positions — symmetrical around the table
// Self is at bottom center (not rendered here), opponents go clockwise from bottom-left
const OPPONENT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  1: [
    { top: '8%', left: '50%' },         // top center
  ],
  2: [
    { top: '12%', left: '25%' },        // top-left
    { top: '12%', left: '75%' },        // top-right
  ],
  3: [
    { top: '12%', left: '20%' },        // top-left
    { top: '8%', left: '50%' },         // top center
    { top: '12%', left: '80%' },        // top-right
  ],
  4: [
    { top: '80%', left: '10%' },        // bottom-left
    { top: '10%', left: '30%' },        // top-left
    { top: '10%', left: '70%' },        // top-right
    { top: '80%', left: '90%' },        // bottom-right
  ],
  5: [
    { top: '80%', left: '10%' },        // bottom-left
    { top: '15%', left: '10%' },        // top-left
    { top: '8%', left: '50%' },         // top center
    { top: '15%', left: '90%' },        // top-right
    { top: '80%', left: '90%' },        // bottom-right
  ],
  6: [
    { top: '80%', left: '10%' },        // bottom-left
    { top: '15%', left: '10%' },        // top-left
    { top: '8%', left: '38%' },         // top-center-left
    { top: '8%', left: '62%' },         // top-center-right
    { top: '15%', left: '90%' },        // top-right
    { top: '80%', left: '90%' },        // bottom-right
  ],
  7: [
    { top: '80%', left: '10%' },        // bottom-left
    { top: '35%', left: '5%' },         // mid-left
    { top: '8%', left: '25%' },         // top-left
    { top: '8%', left: '50%' },         // top center
    { top: '8%', left: '75%' },         // top-right
    { top: '35%', left: '95%' },        // mid-right
    { top: '80%', left: '90%' },        // bottom-right
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
const SELF_POSITION = { top: '110%', left: '50%' }

// Calculate bet chip position: lerp from player toward center
// Place bet chips along the player→center vector, at a fixed distance from player
function getBetPosition(playerPos: { top: string; left: string }): { top: string; left: string } {
  const px = parseFloat(playerPos.left)
  const py = parseFloat(playerPos.top)
  const cx = 50 // table center X
  const cy = 48 // table center Y

  const dx = cx - px
  const dy = cy - py
  const dist = Math.sqrt(dx * dx + dy * dy) || 1

  const chipDist = 14 // fixed distance in % units
  const nx = (dx / dist) * chipDist
  const ny = (dy / dist) * chipDist

  let resultTop = py + ny
  let resultLeft = px + nx

  // Clamp: keep chips out of community card zone (top 35%-55%, left 30%-70%)
  if (resultTop > 32 && resultTop < 58 && resultLeft > 28 && resultLeft < 72) {
    // Too close to center — push back toward player
    resultTop = py + ny * 0.5
    resultLeft = px + nx * 0.5
  }

  return {
    top: `${resultTop.toFixed(1)}%`,
    left: `${resultLeft.toFixed(1)}%`,
  }
}

export function PokerTable() {
  const room = useGameStore((s) => s.room)
  const myCards = useGameStore((s) => s.myCards)
  const currentTurn = useGameStore((s) => s.currentTurn)
  const turnDeadline = useGameStore((s) => s.turnDeadline)
  const handsArr = useGameStore((s) => s.hands)
  const playerId = useGameStore((s) => s.user?.id ?? null)
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

  // Request fullscreen + lock landscape on game enter
  useEffect(() => {
    const el = document.documentElement
    const requestFS = el.requestFullscreen
      ?? (el as any).webkitRequestFullscreen
      ?? (el as any).msRequestFullscreen
    if (requestFS && !document.fullscreenElement) {
      requestFS.call(el).catch(() => {})
    }
    try {
      ;(screen.orientation as any)?.lock?.('landscape').catch(() => {})
    } catch {}
    // Fallback: request fullscreen on first user tap (required by some browsers)
    const onTap = () => {
      if (!document.fullscreenElement) {
        const r = el.requestFullscreen ?? (el as any).webkitRequestFullscreen
        if (r) r.call(el).catch(() => {})
      }
      document.removeEventListener('click', onTap)
    }
    document.addEventListener('click', onTap, { once: true })

    return () => {
      document.removeEventListener('click', onTap)
      const exitFS = document.exitFullscreen ?? (document as any).webkitExitFullscreen
      if (exitFS && document.fullscreenElement) {
        exitFS.call(document).catch(() => {})
      }
    }
  }, [])

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [])

  // Sync raise amount and close panel when turn changes
  useEffect(() => {
    setRaiseAmount(minRaise)
    setRaiseOpen(false)
  }, [minRaise, currentTurn])

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
  // minRaise from server = minimum raise INCREMENT, effectiveMinRaise = minimum TOTAL bet to raise
  const effectiveMinRaise = currentBet + minRaise
  const maxRaiseBet = myBet + myChips // max total bet = already bet + remaining chips
  const effectiveRaise = Math.min(Math.max(raiseAmount, effectiveMinRaise), maxRaiseBet)
  const halfPot = Math.max(effectiveMinRaise, Math.floor(pot / 2) + currentBet)
  const fullPot = Math.max(effectiveMinRaise, pot + currentBet)
  const canRaise = maxRaiseBet >= effectiveMinRaise

  const handleRaise = () => sendAction('raise', effectiveRaise)
  const handleAllIn = () => sendAction('allIn', myChips)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const toggleReady = useGameStore((s) => s.toggleReady)
  const [menuOpen, setMenuOpen] = useState(false)
  const [raiseOpen, setRaiseOpen] = useState(false)

  const isWaiting = room?.status === 'waiting'
  const amIReady = me?.isReady ?? false

  // Parse my avatar
  const myAvatarParts = (me?.avatar ?? '👤:#888888').split(':')
  const myEmoji = myAvatarParts[0] || '👤'
  const myColor = myAvatarParts[1] || '#888888'

  // Winner info for inline display
  const winnerPlayer = settleWinners.length > 0
    ? players.find(p => p.seatIndex === settleWinners[0].seatIndex)
    : null
  const winnerEmoji = winnerPlayer ? parseAvatar(winnerPlayer.avatar).emoji : ''
  const winAmount = settleWinners.length > 0 ? settleWinners[0].amount : 0

  function parseAvatar(avatar: string) {
    const parts = avatar.split(':')
    return { emoji: parts[0] || '👤', color: parts[1] || '#888' }
  }

  return (
    <div className="fixed inset-0 bg-[#131313] flex flex-col">
      {/* Menu button — top left */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed top-3 left-3 z-50 w-9 h-9 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/70">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {/* Sidebar overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          {/* Sidebar */}
          <div className="relative w-64 h-full bg-[#1c1b1b] border-r border-white/10 flex flex-col shadow-2xl animate-[slideIn_0.2s_ease-out]">
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-headline font-bold text-[#e9c349] text-lg">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="text-white/40 hover:text-white/80 text-xl">&times;</button>
            </div>

            {/* Room info */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Room</div>
              <div className="font-mono text-[#e9c349] text-lg tracking-widest">{room?.code}</div>
              <div className="text-[11px] text-white/40 mt-1">
                {players.length} players · {room?.config.blinds.small}/{room?.config.blinds.big} blinds
              </div>
            </div>

            {/* Player list */}
            <div className="px-4 py-3 border-b border-white/5 flex-1 overflow-y-auto">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Players</div>
              <div className="space-y-2">
                {players.map(p => {
                  const pa = (p.avatar || '👤:#888').split(':')
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: pa[1] || '#888' }}>{pa[0]}</div>
                      <span className="text-xs text-white/70 flex-1 truncate">{p.nickname}</span>
                      <span className="text-[10px] font-headline font-bold text-[#e9c349]">{p.chips.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-4">
              <button
                onClick={() => { setMenuOpen(false); leaveRoom() }}
                className="w-full py-2.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 font-headline font-bold text-sm uppercase hover:bg-red-600/30 transition-colors"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table area — flex-1 minus HUD height */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4">
        {/* Table container */}
        <div className="relative w-full max-w-5xl max-h-full" style={{ aspectRatio: '2.2/1' }}>
          {/* Outer border */}
          {/* Golden inner border — inset inside the grey border, above table, below players */}
          <div className="absolute inset-[12px] rounded-[188px] border-[3px] border-primary/40 pointer-events-none z-10" />
          <div className="absolute inset-0 rounded-[200px] border-[12px] border-[#2a2a2a] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Felt surface */}
            <div className="absolute inset-0 poker-felt">
              {/* Community cards — always show 5 slots, undealt as face-down */}
              <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 scale-[0.7] sm:scale-100 origin-center flex flex-col items-center gap-1">
                {/* Pot / Winner display — above community cards, highest z */}
                <div>
                  {settleWinners.length > 0 && winnerPlayer ? (
                    /* Winner banner — replaces POT, no overlay */
                    <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-5 py-1.5 rounded-full border border-[#e9c349]/40 animate-[winGlow_1.5s_ease-in-out_2]">
                      <span className="text-xl">{winnerEmoji}</span>
                      <div className="flex items-start gap-1">
                        <span className="font-headline font-extrabold text-sm text-[#e9c349] leading-tight">
                          {winnerPlayer.nickname} wins!
                        </span>
                        <span className="text-[#96d59b] text-sm font-bold leading-tight">
                          +{winAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : pot > 0 ? (
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-5 py-1.5 rounded-full border border-[#e9c349]/20">
                      <span className="font-headline font-extrabold text-sm text-[#e9c349] tracking-tighter">
                        POT : ${pot.toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className='flex gap-1 sm:gap-2'>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const card = communityCards[i] ?? null
                    const isDealt = i < communityCards.length
                    return (
                      <div
                        key={i}
                        className="card-flip-container"
                        style={{ perspective: '600px' }}
                      >
                        <div
                          className={`card-flip-inner ${isDealt ? 'flipped' : ''}`}
                          style={{
                            transition: 'transform 0.5s ease',
                            transitionDelay: isDealt ? `${i * 100}ms` : '0ms',
                            transformStyle: 'preserve-3d',
                            transform: isDealt ? 'rotateY(180deg)' : 'rotateY(0deg)',
                          }}
                        >
                          {/* Back face (default visible) */}
                          <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>
                            <PlayingCard card={null} />
                          </div>
                          {/* Front face (visible when flipped) */}
                          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                            {isDealt ? <PlayingCard card={card} /> : <PlayingCard card={null} />}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bet chip piles */}
          {[...seatPositionMap.entries()].map(([seatIndex, position]) => {
            const hand = handsMap.get(seatIndex)
            const bet = hand?.bet ?? 0
            if (bet <= 0) return null
            const displayBet = bet
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
                amount={displayBet}
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

            // Determine side based on left position
            const leftPct = parseFloat(position.left)
            const side = leftPct > 60 ? 'right' : leftPct < 40 ? 'left' : 'top'

            // Timer progress for this seat
            const turnTime = (room?.config.turnTime ?? 30) * 1000
            const seatTimerProgress = (currentTurn === seatIndex && turnDeadline)
              ? Math.max(0, Math.min(1, (turnDeadline - now) / turnTime))
              : 0

            return (
              <PlayerSeat
                key={seatIndex}
                player={player}
                isCurrentTurn={currentTurn === seatIndex}
                cards={cards}
                bet={hand?.bet ?? 0}
                isDealer={dealerSeat === seatIndex}
                timerProgress={seatTimerProgress}
                side={side}
                style={{ top: position.top, left: position.left }}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom HUD — single thin row */}
      <div className="flex-shrink-0 bg-[#131313]/95 border-t border-white/10 px-2 sm:px-4 h-[52px] flex items-center">
        <div className="w-full max-w-5xl mx-auto flex items-center gap-2 sm:gap-3">
          {/* Avatar with countdown ring */}
          {(() => {
            const avatarSize = 32
            const sw = 3
            const r = (avatarSize + sw * 2) / 2
            const c = 2 * Math.PI * (avatarSize / 2)
            const turnTime = (room?.config.turnTime ?? 30) * 1000
            const myTimer = (isMyTurn && turnDeadline) ? Math.max(0, Math.min(1, (turnDeadline - now) / turnTime)) : 0
            const ringColor = myTimer > 0.5 ? '#96d59b' : myTimer > 0.2 ? '#e9c349' : '#ef4444'
            return (
              <div className="relative flex-shrink-0" style={{ width: avatarSize + sw * 2, height: avatarSize + sw * 2 }}>
                {isMyTurn && (
                  <svg className="absolute inset-0" width={avatarSize + sw * 2} height={avatarSize + sw * 2} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={r} cy={r} r={avatarSize / 2} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={sw} />
                    <circle cx={r} cy={r} r={avatarSize / 2} fill="none" stroke={ringColor} strokeWidth={sw} strokeLinecap="round"
                      strokeDasharray={c} strokeDashoffset={c * (1 - myTimer)}
                      style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
                    />
                  </svg>
                )}
                <div
                  className={`absolute rounded-full ${!isMyTurn ? 'border-2 border-[#e9c349]' : 'border-2 border-transparent'} flex items-center justify-center text-base overflow-hidden`}
                  style={{ backgroundColor: myColor, width: avatarSize, height: avatarSize, top: sw, left: sw }}
                >{myEmoji}</div>
              </div>
            )
          })()}

          {/* My cards (small) */}
          {myCards && (
            <div className="flex -space-x-2 flex-shrink-0">
              <div style={{ transform: 'rotate(-3deg)' }}><PlayingCard card={myCards[0]} small /></div>
              <div style={{ transform: 'rotate(3deg)' }}><PlayingCard card={myCards[1]} small /></div>
            </div>
          )}

          {/* Chips */}
          <div className="font-headline font-bold text-[#e9c349] text-xs flex-shrink-0">{myChips.toLocaleString()}</div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 flex-shrink-0" />

          {isWaiting ? (
            /* Ready / Start controls */
            <div className="flex gap-2 items-center flex-1 justify-center">
              <button
                onClick={toggleReady}
                className={`h-8 px-5 rounded-lg font-headline font-bold text-xs uppercase transition-all ${
                  amIReady
                    ? 'bg-[#96d59b] text-[#131313]'
                    : 'border border-[#96d59b] text-[#96d59b] hover:bg-[#96d59b]/10'
                }`}
              >{amIReady ? '✓ Ready' : 'Ready'}</button>
              <span className="text-[10px] text-white/30">
                {players.filter(p => p.isReady && !p.isAI).length}/{players.filter(p => !p.isAI).length} ready
              </span>
            </div>
          ) : (
            /* Game action buttons */
            <>
              <div className="flex gap-1 sm:gap-1.5 items-center flex-1 justify-center">
                <button
                  onClick={() => sendAction('fold')}
                  disabled={!isMyTurn}
                  className="h-8 px-3 sm:px-4 rounded-lg bg-[#2a2a2a] text-[#e5e2e1]/80 font-headline font-bold text-[11px] sm:text-xs uppercase disabled:opacity-25"
                >Fold</button>

                {canCheck ? (
                  <button
                    onClick={() => sendAction('check')}
                    disabled={!isMyTurn}
                    className="h-8 px-3 sm:px-4 rounded-lg border border-[#96d59b] text-[#96d59b] font-headline font-bold text-[11px] sm:text-xs uppercase disabled:opacity-25"
                  >Check</button>
                ) : callAmount > 0 ? (
                  <button
                    onClick={() => sendAction('call')}
                    disabled={!isMyTurn}
                    className="h-8 px-3 sm:px-4 rounded-lg border border-[#96d59b] text-[#96d59b] font-headline font-bold text-[11px] sm:text-xs uppercase disabled:opacity-25"
                  >Call <span className="opacity-70">{callAmount}</span></button>
                ) : null}

                {/* Raise button with popover */}
                <div className="relative">
                  <button
                    onClick={() => isMyTurn && canRaise && setRaiseOpen(!raiseOpen)}
                    disabled={!isMyTurn || !canRaise}
                    className="h-8 px-3 sm:px-4 rounded-lg bg-gradient-to-b from-[#e9c349] to-[#c4a033] text-[#131313] font-headline font-bold text-[11px] sm:text-xs uppercase disabled:opacity-25"
                  >Raise <span className="opacity-70">{effectiveRaise}</span></button>

                  {/* Raise panel — pops up above the button */}
                  {raiseOpen && isMyTurn && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1a1a1a] border border-[#333] rounded-xl p-3 shadow-2xl min-w-[200px] z-50">
                      {/* Slider */}
                      <input
                        type="range" min={effectiveMinRaise} max={maxRaiseBet} value={effectiveRaise}
                        onChange={(e) => setRaiseAmount(Number(e.target.value))}
                        className="w-full accent-[#e9c349] h-2 mb-2"
                      />
                      {/* Amount display */}
                      <p className="text-center text-[#e9c349] font-mono font-bold text-sm mb-2">{effectiveRaise.toLocaleString()}</p>
                      {/* Preset buttons */}
                      <div className="flex gap-1.5 mb-2">
                        {[{ l: '1/2 Pot', v: halfPot }, { l: 'Pot', v: fullPot }, { l: 'Max', v: maxRaiseBet }].map(({ l, v }) => (
                          <button key={l} onClick={() => setRaiseAmount(v)}
                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-white/10 text-white/70 active:bg-white/20"
                          >{l}</button>
                        ))}
                      </div>
                      {/* Confirm raise */}
                      <button
                        onClick={() => { handleRaise(); setRaiseOpen(false) }}
                        className="w-full py-2 rounded-lg bg-gradient-to-b from-[#e9c349] to-[#c4a033] text-[#131313] font-headline font-bold text-xs uppercase"
                      >确认加注 {effectiveRaise.toLocaleString()}</button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAllIn}
                  disabled={!isMyTurn}
                  className="h-8 px-3 sm:px-4 rounded-lg border border-[#e9c349] text-[#e9c349] font-headline font-bold text-[11px] sm:text-xs uppercase disabled:opacity-25"
                >All In</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
