import { useGameStore } from '../stores/game-store'

export function WaitingRoom() {
  const room = useGameStore((s) => s.room)
  const playerId = useGameStore((s) => s.playerId)
  const toggleReady = useGameStore((s) => s.toggleReady)
  const startGame = useGameStore((s) => s.startGame)
  const leaveRoom = useGameStore((s) => s.leaveRoom)

  if (!room) {
    return (
      <div className="min-h-dvh bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">加载中...</p>
      </div>
    )
  }

  const isHost = room.hostId === playerId
  const me = room.players.find((p) => p.id === playerId)
  const isReady = me?.isReady ?? false
  const maxPlayers = room.config.maxPlayers

  // Build seats array (fill up to maxPlayers)
  const seats = Array.from({ length: maxPlayers }, (_, i) => {
    return room.players.find((p) => p.seatIndex === i) ?? null
  })

  const copyCode = () => {
    navigator.clipboard.writeText(room.code)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(location.origin + '/room/' + room.code)
  }

  return (
    <div className="min-h-dvh bg-black text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-sm text-zinc-400 mb-1">房间号</h2>
          <p className="text-4xl font-black tracking-[0.3em] text-yellow-400">{room.code}</p>
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={copyCode}
              className="text-xs text-zinc-400 border border-zinc-800 rounded-lg px-3 py-1.5 hover:border-zinc-600 transition-colors"
            >
              复制房间码
            </button>
            <button
              onClick={copyLink}
              className="text-xs text-zinc-400 border border-zinc-800 rounded-lg px-3 py-1.5 hover:border-zinc-600 transition-colors"
            >
              复制链接
            </button>
          </div>
        </div>

        {/* Room config */}
        <p className="text-center text-xs text-zinc-500">
          {room.config.blinds.small}/{room.config.blinds.big} 盲注 · {room.config.buyIn.toLocaleString()} 买入 · 最多 {room.config.maxPlayers} 人
        </p>

        {/* Player grid */}
        <div className="grid grid-cols-4 gap-3">
          {seats.map((player, i) =>
            player ? (
              <PlayerSeat
                key={i}
                player={player}
                isHost={player.id === room.hostId}
              />
            ) : (
              <EmptySeat key={i} />
            )
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-2">
          {isHost ? (
            <button
              onClick={startGame}
              disabled={room.players.length < 2}
              className="w-full py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-yellow-400 to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              开始游戏
            </button>
          ) : (
            <button
              onClick={toggleReady}
              className={`w-full py-3.5 rounded-xl font-bold transition-colors ${
                isReady
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-900 border border-zinc-700 text-white hover:border-zinc-500'
              }`}
            >
              {isReady ? '✓ 已准备' : '准备'}
            </button>
          )}
          <button
            onClick={leaveRoom}
            className="w-full py-3 rounded-xl font-bold text-zinc-400 border border-zinc-800 hover:border-zinc-600 transition-colors text-sm"
          >
            退出
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayerSeat({ player, isHost }: { player: { id: string; nickname: string; avatar: string; isReady: boolean }; isHost: boolean }) {
  const [emoji, color] = player.avatar.split(':')
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-14 h-14 rounded-full text-2xl flex items-center justify-center"
        style={{
          backgroundColor: color ?? '#555',
          border: isHost ? '2px solid #eab308' : '2px solid transparent',
        }}
      >
        {emoji}
      </div>
      <p className="text-xs text-white font-medium truncate max-w-full text-center">{player.nickname}</p>
      {isHost ? (
        <span className="text-xs text-yellow-400">👑 房主</span>
      ) : player.isReady ? (
        <span className="text-xs text-green-400">✓ 已准备</span>
      ) : (
        <span className="text-xs text-zinc-500">等待中...</span>
      )}
    </div>
  )
}

function EmptySeat() {
  return (
    <div className="flex flex-col items-center gap-1.5 opacity-30">
      <div className="w-14 h-14 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center text-zinc-500 text-xl">
        +
      </div>
      <p className="text-xs text-zinc-600">空位</p>
    </div>
  )
}
