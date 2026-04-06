import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/game-store'
import { HAND_RANK_NAMES } from '@texas-holdem/shared'

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const RED_SUITS = new Set(['hearts', 'diamonds'])

const COUNTDOWN_SECONDS = 5

export function SettleOverlay() {
  const { settleWinners, settleShowCards, showdownResults, room, playerId, clearSettle, showCards } =
    useGameStore()

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    setCountdown(COUNTDOWN_SECONDS)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          clearSettle()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [clearSettle])

  if (settleWinners.length === 0) return null

  const players = room?.players ?? []
  const playerMap = new Map(players.map((p) => [p.seatIndex, p]))

  const primaryWinner = settleWinners[0]
  const winnerPlayer = playerMap.get(primaryWinner.seatIndex)
  const winnerEmoji = (winnerPlayer?.avatar ?? '👤:#888888').split(':')[0]
  const winnerName = winnerPlayer?.nickname ?? `Seat ${primaryWinner.seatIndex}`

  const myPlayer = players.find((p) => p.id === playerId)
  const isMe = myPlayer?.seatIndex === primaryWinner.seatIndex

  const winnerShowdown = showdownResults.find((r) => r.seatIndex === primaryWinner.seatIndex)
  const handRankLabel = winnerShowdown?.handName
    ? HAND_RANK_NAMES[winnerShowdown.handName] ?? winnerShowdown.handName
    : null

  const showRevealButton = !settleShowCards && isMe

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
      <div className="bg-[#1c1b1b] border border-[#e9c349]/40 rounded-2xl p-6 min-w-[280px] max-w-[360px] text-center shadow-2xl">
        {/* Header */}
        <div className="text-[#e9c349] text-sm font-headline font-bold mb-3">🏆 WINNER</div>

        {/* Winner avatar */}
        <div className="text-4xl mb-2">{winnerEmoji}</div>

        {/* Winner name */}
        <div className="text-[#e9c349] text-xl font-headline font-bold mb-2">{winnerName}</div>

        {/* Hand rank + cards (showdown) */}
        {settleShowCards && winnerShowdown && (
          <div className="mb-3">
            <div className="text-[#96d59b] text-sm font-semibold mb-2">{handRankLabel}</div>
            <div className="flex justify-center gap-2">
              {winnerShowdown.cards.map((card, i) => {
                const isRed = RED_SUITS.has(card.suit)
                const suitSymbol = SUIT_SYMBOLS[card.suit] ?? card.suit
                return (
                  <div
                    key={i}
                    className={`w-10 h-14 rounded-lg bg-[#e5e2e1] border border-[#2a2a2a] flex flex-col items-center justify-center shadow ${isRed ? 'text-red-500' : 'text-[#131313]'}`}
                  >
                    <span className="text-sm font-bold leading-none">{card.rank}</span>
                    <span className="text-base leading-none">{suitSymbol}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Multiple winners */}
        {settleWinners.length > 1 && (
          <div className="mb-3 space-y-1">
            {settleWinners.slice(1).map((w, i) => {
              const p = playerMap.get(w.seatIndex)
              const emoji = (p?.avatar ?? '👤:#888888').split(':')[0]
              const name = p?.nickname ?? `Seat ${w.seatIndex}`
              return (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1 text-sm">
                  <span>{emoji}</span>
                  <span className="text-[#e5e2e1]">{name}</span>
                  <span className="text-[#e9c349]">+{w.amount.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Win amount */}
        <div className="text-[#e9c349] text-2xl font-headline font-bold mb-4">
          +{primaryWinner.amount.toLocaleString()}
        </div>

        {/* Show cards button */}
        {showRevealButton && (
          <button
            onClick={showCards}
            className="w-full py-2 mb-3 rounded-xl bg-white/10 text-[#e5e2e1] font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
          >
            Show Cards
          </button>
        )}

        {/* Countdown */}
        <div className="text-white/40 text-xs">
          Next hand ({countdown}s)
        </div>
      </div>
    </div>
  )
}
