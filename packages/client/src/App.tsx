import { useEffect } from 'react'
import { useGameStore } from './stores/game-store'
import { Login } from './components/Login'
import { Lobby } from './components/Lobby'
import { WaitingRoom } from './components/WaitingRoom'
import { PokerTable } from './game/PokerTable'

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
      return <WaitingRoom />
    case 'game':
      return <PokerTable />
    default:
      return <Login />
  }
}

export default App
