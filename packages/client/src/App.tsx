import { useGameStore } from './stores/game-store'
import { Lobby } from './components/Lobby'
import { WaitingRoom } from './components/WaitingRoom'
import { PokerTable } from './game/PokerTable'

export function App() {
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
