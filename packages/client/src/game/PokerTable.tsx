import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'
import { useGameStore } from '../stores/game-store'
import { TableScene, type TableSceneState } from './table-scene'
import { ActionBar } from '../components/ActionBar'
import { SettleOverlay } from '../components/SettleOverlay'

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

  const me = room?.players.find((p) => p.id === playerId)
  const mySeatIndex = me?.seatIndex ?? 0

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Pixi canvas area — 75% height */}
      <div ref={canvasRef} className="flex-1" style={{ height: '75%' }} />

      {/* Action bar */}
      <ActionBar mySeatIndex={mySeatIndex} />

      {/* Settle overlay */}
      {settleWinners.length > 0 && <SettleOverlay />}
    </div>
  )
}

