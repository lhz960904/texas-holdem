import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/game-store'

const AVATARS = [
  { emoji: '🦊', color: '#e74c3c' },
  { emoji: '🐺', color: '#3498db' },
  { emoji: '🦁', color: '#2ecc71' },
  { emoji: '🐱', color: '#9b59b6' },
  { emoji: '🐼', color: '#f39c12' },
  { emoji: '🦈', color: '#1abc9c' },
]

export function Lobby() {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const initConnection = useGameStore((s) => s.initConnection)

  useEffect(() => {
    const code = sessionStorage.getItem('joinCode')
    if (code) {
      setRoomCode(code)
      sessionStorage.removeItem('joinCode')
    }
  }, [])

  const selectedAvatar = AVATARS[selectedIndex]

  const handleCreate = async () => {
    if (!nickname.trim()) return
    const { emoji, color } = selectedAvatar
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        avatar: `${emoji}:${color}`,
        config: { blinds: { small: 10, big: 20 }, buyIn: 1000, maxPlayers: 6, turnTime: 30 },
      }),
    })
    const data = await res.json()
    initConnection(data.playerId)
    setTimeout(() => {
      useGameStore.getState().joinRoom(data.code, nickname, `${emoji}:${color}`)
    }, 500)
  }

  const handleJoin = () => {
    if (!nickname.trim() || !roomCode.trim()) return
    const { emoji, color } = selectedAvatar
    const playerId = crypto.randomUUID()
    initConnection(playerId)
    setTimeout(() => {
      useGameStore.getState().joinRoom(roomCode.toUpperCase(), nickname, `${emoji}:${color}`)
    }, 500)
  }

  return (
    <div className="min-h-dvh bg-black text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div className="text-center mb-2">
          <h1 className="text-5xl font-black tracking-widest bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            ALL IN
          </h1>
          <p className="text-zinc-400 text-sm mt-1">和朋友来一局德州</p>
        </div>

        {/* Avatar picker */}
        <div>
          <p className="text-xs text-zinc-400 mb-2">选择头像</p>
          <div className="flex gap-2 justify-between">
            {AVATARS.map((av, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className="w-12 h-12 rounded-full text-2xl flex items-center justify-center flex-shrink-0 transition-transform"
                style={{
                  backgroundColor: av.color,
                  border: i === selectedIndex ? '2px solid #eab308' : '2px solid transparent',
                  transform: i === selectedIndex ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {av.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Nickname input */}
        <div>
          <p className="text-xs text-zinc-400 mb-2">昵称</p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="输入昵称..."
            maxLength={16}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        {/* Create room button */}
        <button
          onClick={handleCreate}
          disabled={!nickname.trim()}
          className="w-full py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-yellow-400 to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          创建房间
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-500 text-sm">或</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Room code input */}
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="输入房间码"
          maxLength={6}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-center font-mono tracking-widest uppercase outline-none focus:border-yellow-500 transition-colors"
        />

        {/* Join room button */}
        <button
          onClick={handleJoin}
          disabled={!nickname.trim() || !roomCode.trim()}
          className="w-full py-3.5 rounded-xl font-bold text-white bg-zinc-900 border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:border-zinc-600 transition-colors"
        >
          加入房间
        </button>
      </div>
    </div>
  )
}
