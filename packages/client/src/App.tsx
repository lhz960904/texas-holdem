import { useEffect, lazy, Suspense } from 'react'
import { useGameStore } from './stores/game-store'
import { Login } from './components/Login'
import { Lobby } from './components/Lobby'

const WaitingRoom = lazy(() => import('./components/WaitingRoom').then(m => ({ default: m.WaitingRoom })))
const PokerTable = lazy(() => import('./game/PokerTable').then(m => ({ default: m.PokerTable })))

function LoadingScreen() {
  return (
    <div className="h-dvh bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
      <div className="text-4xl">🃏</div>
      <div className="w-10 h-10 border-2 border-[#e9c349]/30 border-t-[#e9c349] rounded-full animate-spin" />
    </div>
  )
}

export function App() {
  const tryReconnect = useGameStore((s) => s.tryReconnect)

  useEffect(() => {
    // Check URL-based room join
    const path = window.location.pathname
    const match = path.match(/^\/room\/([A-Z0-9]{6})$/i)
    if (match) {
      const code = match[1].toUpperCase()
      sessionStorage.setItem('joinCode', code)
    }

    // Try to restore session from stored token
    tryReconnect()
  }, [])

  const screen = useGameStore((s) => s.screen)

  useEffect(() => {
    document.body.classList.toggle('force-landscape', screen === 'game')
    return () => document.body.classList.remove('force-landscape')
  }, [screen])

  switch (screen) {
    case 'login':
      return <Login />
    case 'lobby':
    case 'room-setup':
      return <Lobby />
    case 'waiting':
      return <Suspense fallback={<LoadingScreen />}><WaitingRoom /></Suspense>
    case 'game':
      return <Suspense fallback={<div />}><PokerTable /></Suspense>
    default:
      return <Login />
  }
}

export default App
