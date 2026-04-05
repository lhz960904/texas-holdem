import { useEffect } from 'react'
import { useGameStore } from './stores/game-store'
import { Lobby } from './components/Lobby'
import { WaitingRoom } from './components/WaitingRoom'
import { PokerTable } from './game/PokerTable'

export function App() {
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/^\/room\/([A-Z0-9]{6})$/i)
    if (match) {
      const code = match[1].toUpperCase()
      sessionStorage.setItem('joinCode', code)
      // Stay on lobby screen — Lobby component reads joinCode from sessionStorage
    }
  }, [])

  const screen = useGameStore((s) => s.screen)
  switch (screen) {
    case 'lobby':
    case 'room-setup':
      return <Lobby />
    case 'waiting':
      return <WaitingRoom />
    case 'game':
      return <PokerTable />
    default:
      return <Lobby />
  }
}

export default App
