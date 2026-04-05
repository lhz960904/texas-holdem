import { useGameStore } from './stores/game-store'
import { Lobby } from './components/Lobby'
import { WaitingRoom } from './components/WaitingRoom'

export function App() {
  const screen = useGameStore((s) => s.screen)
  switch (screen) {
    case 'lobby':
    case 'room-setup':
      return <Lobby />
    case 'waiting':
      return <WaitingRoom />
    case 'game':
      return (
        <div className="min-h-dvh bg-black text-white flex items-center justify-center">
          <p>Game table loading...</p>
        </div>
      )
    default:
      return <Lobby />
  }
}

export default App
