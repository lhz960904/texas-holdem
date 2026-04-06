import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/game-store'
import { requestMicPermission } from '../hooks/use-voice'

interface AIPersonality {
  id: string
  name: string
  avatar: string
  description: string
}

export function WaitingRoom() {
  const room = useGameStore((s) => s.room)
  const user = useGameStore((s) => s.user)
  const toggleReady = useGameStore((s) => s.toggleReady)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const wsClient = useGameStore((s) => s.wsClient)
  const playerId = user?.id

  const [aiPersonalities, setAiPersonalities] = useState<AIPersonality[]>([])
  const [showAIPicker, setShowAIPicker] = useState(false)

  // Pre-request mic permission before game enters fullscreen
  useEffect(() => {
    requestMicPermission()
  }, [])

  // Request AI personalities list on mount
  useEffect(() => {
    if (!wsClient) return
    const unsub = wsClient.on('ai-personalities', ({ personalities }) => {
      setAiPersonalities(personalities)
    })
    wsClient.send('list-ai-personalities', {})
    return unsub
  }, [wsClient])

  if (!room) {
    return (
      <div className="h-dvh bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-zinc-500">加载中...</p>
      </div>
    )
  }

  const isHost = room.hostId === playerId
  const me = room.players.find((p) => p.id === playerId)
  const isReady = me?.isReady ?? false
  const maxPlayers = room.config.maxPlayers

  const uniquePlayers = room.players.filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
  )

  const seats = Array.from({ length: maxPlayers }, (_, i) => {
    return uniquePlayers.find((p) => p.seatIndex === i) ?? null
  })

  const hasEmptySeats = uniquePlayers.length < maxPlayers

  const copyCode = () => navigator.clipboard.writeText(room.code)
  const copyLink = () => navigator.clipboard.writeText(location.origin + '/room/' + room.code)

  const addAI = (personalityId: string) => {
    wsClient?.send('add-ai', { personalityId })
    setShowAIPicker(false)
  }

  const removeAI = (aiPlayerId: string) => {
    wsClient?.send('remove-ai', { playerId: aiPlayerId })
  }

  return (
    <div className="h-dvh bg-[#0a0a0a] text-white flex flex-col landscape:flex-row overflow-hidden">
      {/* Left panel: room info */}
      <div className="flex flex-col items-center justify-center px-4 py-6 landscape:w-[280px] landscape:min-w-[280px] landscape:border-r landscape:border-[#1a1a1a] landscape:py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#b8860b] mb-1">Room Code</p>
        <p className="text-3xl font-black tracking-[0.25em] text-[#d4a843] font-mono">{room.code}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={copyCode}
            className="text-[10px] text-[#8a7a5a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-[#4a4a3a] hover:text-[#b8a060] transition-colors bg-[#111]"
          >
            复制房间码
          </button>
          <button
            onClick={copyLink}
            className="text-[10px] text-[#8a7a5a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-[#4a4a3a] hover:text-[#b8a060] transition-colors bg-[#111]"
          >
            复制链接
          </button>
        </div>
        <p className="text-[10px] text-[#555] mt-3">
          {room.config.blinds.small}/{room.config.blinds.big} 盲注 · {maxPlayers} 人
        </p>

        {/* Portrait: action buttons */}
        <div className="flex gap-2 mt-4 landscape:hidden w-full max-w-[300px]">
          <button
            onClick={leaveRoom}
            className="flex-1 py-2.5 rounded-lg font-bold text-[#8a7a5a] border border-[#2a2a2a] hover:border-[#4a4a3a] transition-colors text-xs bg-[#111]"
          >
            退出
          </button>
          <button
            onClick={toggleReady}
            className={`flex-[2] py-2.5 rounded-lg font-bold text-sm transition-all ${
              isReady
                ? 'bg-[#1a3a1a] border border-[#2a5a2a] text-[#4ade80]'
                : 'bg-gradient-to-r from-[#b8860b] to-[#d4a843] text-black'
            }`}
          >
            {isReady ? '✓ 已准备' : '准备'}
          </button>
        </div>
      </div>

      {/* Right/Main panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 landscape:py-2 overflow-auto">
        {/* Player grid */}
        <div className="grid grid-cols-3 landscape:grid-cols-4 gap-3 landscape:gap-4 w-full max-w-[520px]">
          {seats.map((player, i) =>
            player ? (
              <PlayerSeat
                key={player.id}
                player={player}
                isHost={player.id === room.hostId}
                isMe={player.id === playerId}
                canRemove={isHost && !!player.isAI}
                onRemove={() => removeAI(player.id)}
              />
            ) : (
              <EmptySeat key={`empty-${i}`} />
            )
          )}
        </div>

        {/* AI + Action buttons (landscape) */}
        <div className="flex gap-3 mt-4 w-full max-w-[520px] flex-wrap justify-center">
          {/* Add AI button — host only, has empty seats */}
          {isHost && hasEmptySeats && (
            <button
              onClick={() => setShowAIPicker(!showAIPicker)}
              className="px-4 py-2.5 rounded-lg font-bold text-sm text-[#d4a843] border border-[#3a3a2a] hover:border-[#5a5a3a] bg-[#111] transition-colors"
            >
              🤖 + AI
            </button>
          )}

          <div className="hidden landscape:flex gap-3 flex-1">
            <button
              onClick={leaveRoom}
              className="flex-1 py-2.5 rounded-lg font-bold text-[#8a7a5a] border border-[#2a2a2a] hover:border-[#4a4a3a] transition-colors text-xs bg-[#111]"
            >
              退出房间
            </button>
            <button
              onClick={toggleReady}
              className={`flex-[2] py-2.5 rounded-lg font-bold text-sm transition-all ${
                isReady
                  ? 'bg-[#1a3a1a] border border-[#2a5a2a] text-[#4ade80]'
                  : 'bg-gradient-to-r from-[#b8860b] to-[#d4a843] text-black'
              }`}
            >
              {isReady ? '✓ 已准备' : '准备'}
            </button>
          </div>
        </div>

        {/* AI Personality Picker */}
        {showAIPicker && (
          <div className="mt-3 w-full max-w-[520px] bg-[#111] border border-[#2a2a2a] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-[#8a7a5a] mb-2">选择 AI 性格</p>
            <div className="grid grid-cols-2 gap-2">
              {aiPersonalities.map((p) => {
                const [emoji] = p.avatar.split(':')
                return (
                  <button
                    key={p.id}
                    onClick={() => addAI(p.id)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-[#2a2a2a] hover:border-[#d4a843] transition-colors text-left"
                  >
                    <span className="text-xl">{emoji}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{p.name}</p>
                      <p className="text-[9px] text-[#666]">{p.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerSeat({
  player,
  isHost,
  isMe,
  canRemove,
  onRemove,
}: {
  player: { id: string; nickname: string; avatar: string; isReady: boolean; chips: number; isAI?: boolean }
  isHost: boolean
  isMe: boolean
  canRemove: boolean
  onRemove: () => void
}) {
  const [emoji, color] = player.avatar.split(':')
  return (
    <div
      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
        isMe ? 'bg-[#1a1a10] border border-[#3a3a2a]' : 'bg-[#111] border border-[#1a1a1a]'
      }`}
    >
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#333] text-[#888] hover:bg-red-900 hover:text-red-400 flex items-center justify-center text-[10px] transition-colors"
        >
          ✕
        </button>
      )}
      <div className="relative">
        <div
          className="w-11 h-11 rounded-full text-xl flex items-center justify-center"
          style={{
            backgroundColor: color ?? '#555',
            boxShadow: isHost
              ? '0 0 0 2px #0a0a0a, 0 0 0 4px #d4a843'
              : player.isReady
                ? '0 0 0 2px #0a0a0a, 0 0 0 4px #4ade80'
                : 'none',
          }}
        >
          {emoji}
        </div>
        {isHost && <span className="absolute -top-1 -right-1 text-[10px]">👑</span>}
        {player.isAI && !isHost && <span className="absolute -top-1 -left-1 text-[10px]">🤖</span>}
      </div>
      <p className="text-[11px] text-white font-medium truncate max-w-full text-center leading-tight">
        {player.nickname}
      </p>
      <div className="flex items-center gap-1">
        {player.chips <= 0 ? (
          <span className="text-[9px] text-red-400 font-medium">筹码不足</span>
        ) : player.isReady ? (
          <span className="text-[9px] text-[#4ade80] font-medium">已准备</span>
        ) : isHost ? (
          <span className="text-[9px] text-[#d4a843] font-medium">房主</span>
        ) : (
          <span className="text-[9px] text-[#555]">等待中</span>
        )}
      </div>
      <p className={`text-[9px] font-mono ${player.chips <= 0 ? 'text-red-400' : 'text-[#8a7a5a]'}`}>
        {player.chips.toLocaleString()}
      </p>
    </div>
  )
}

function EmptySeat() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl border border-dashed border-[#222] bg-[#0d0d0d] opacity-40">
      <div className="w-11 h-11 rounded-full border border-dashed border-[#333] flex items-center justify-center text-[#444] text-lg">
        +
      </div>
      <p className="text-[10px] text-[#444]">空位</p>
    </div>
  )
}
