import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'
import { useGameStore } from '../stores/game-store'
import { TableScene, type TableSceneState } from './table-scene'

export function PokerTable() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const sceneRef = useRef<TableScene | null>(null)

  const room = useGameStore((s) => s.room)
  const myCards = useGameStore((s) => s.myCards)
  const currentTurn = useGameStore((s) => s.currentTurn)
  const turnDeadline = useGameStore((s) => s.turnDeadline)
  const handsArr = useGameStore((s) => s.hands)
  const playerId = useGameStore((s) => s.playerId)
  const settleWinners = useGameStore((s) => s.settleWinners)
  const showdownResults = useGameStore((s) => s.showdownResults)

  // --- Lock landscape orientation ---
  useEffect(() => {
    try {
      ;(screen.orientation as any)?.lock?.('landscape').catch(() => {})
    } catch {}
  }, [])

  // --- Initialize Pixi application ---
  useEffect(() => {
    if (!canvasRef.current) return

    const app = new Application()
    appRef.current = app

    app
      .init({
        background: 0x0d1f15,
        resizeTo: canvasRef.current,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        if (!canvasRef.current) return
        canvasRef.current.appendChild(app.canvas)
        sceneRef.current = new TableScene(app)
      })

    return () => {
      sceneRef.current?.destroy()
      sceneRef.current = null
      app.destroy(true, { children: true })
      appRef.current = null
    }
  }, [])

  // --- Build state and render ---
  useEffect(() => {
    const renderScene = () => {
      const scene = sceneRef.current
      const app = appRef.current
      if (!scene || !app) return
      if (!room || !room.game) return

      const me = room.players.find((p) => p.id === playerId)
      const mySeatIndex = me?.seatIndex ?? 0

      // Build hands map from handsArr
      const handsMap = new Map<number, { bet: number; cards?: [import('@texas-holdem/shared').Card, import('@texas-holdem/shared').Card] | null }>()
      for (const h of handsArr) {
        handsMap.set(h.seatIndex, { bet: h.bet, cards: h.cards ?? null })
      }

      // Merge showdown revealed cards
      if (showdownResults.length > 0) {
        for (const r of showdownResults) {
          const existing = handsMap.get(r.seatIndex)
          handsMap.set(r.seatIndex, { bet: existing?.bet ?? 0, cards: r.cards })
        }
      }

      const state: TableSceneState = {
        players: room.players,
        mySeatIndex,
        communityCards: room.game.communityCards,
        pot: room.game.pot,
        currentTurn: currentTurn ?? -1,
        turnDeadline: turnDeadline ?? 0,
        hands: handsMap,
        myCards,
        speakingSeat: new Set(), // LiveKit integration in Task 11
      }

      scene.render(state)
    }

    renderScene()

    // Re-render every second for timer countdown
    const interval = setInterval(renderScene, 1000)
    return () => clearInterval(interval)
  }, [room, myCards, currentTurn, turnDeadline, handsArr, playerId, showdownResults])

  // --- Settle overlay ---
  const showSettle = settleWinners.length > 0

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Pixi canvas area — 75% height */}
      <div ref={canvasRef} className="flex-1" style={{ height: '75%' }} />

      {/* ActionBar placeholder — Task 10 will replace this */}
      <div className="h-[25%] bg-black/90 border-t border-white/[0.08]" />

      {/* Settle overlay */}
      {showSettle && (
        <SettleOverlay
          winners={settleWinners}
          players={room?.players ?? []}
          onClose={() => useGameStore.getState().clearSettle()}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Minimal settle overlay
// ---------------------------------------------------------------------------

import type { SettleWinner, PlayerInfo } from '@texas-holdem/shared'

interface SettleOverlayProps {
  winners: SettleWinner[]
  players: PlayerInfo[]
  onClose: () => void
}

function SettleOverlay({ winners, players, onClose }: SettleOverlayProps) {
  const playerMap = new Map(players.map((p) => [p.seatIndex, p]))

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
      <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl p-6 min-w-[280px] max-w-[400px] text-center shadow-2xl">
        <div className="text-yellow-400 text-xl font-bold mb-4">🏆 Round Over</div>

        <div className="space-y-2 mb-6">
          {winners.map((w, i) => {
            const player = playerMap.get(w.seatIndex)
            const name = player?.nickname ?? `Seat ${w.seatIndex}`
            const avatarParts = (player?.avatar ?? '👤:#888888').split(':')
            const emojiChar = avatarParts[0]
            return (
              <div
                key={i}
                className="flex items-center justify-between bg-yellow-500/10 rounded-xl px-4 py-2"
              >
                <span className="text-lg">{emojiChar}</span>
                <span className="text-white font-semibold">{name}</span>
                <span className="text-yellow-400 font-bold">+${w.amount}</span>
              </div>
            )
          })}
        </div>

        <button
          className="w-full py-2 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors"
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
