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

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
}

function InstallBanner() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem('pwa-dismissed')) return
    setShow(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const dismiss = () => {
    setShow(false)
    localStorage.setItem('pwa-dismissed', '1')
  }

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      dismiss()
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-[#1a1a1a] border border-[#333] rounded-xl p-3 flex items-center gap-3 z-50 shadow-2xl">
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-bold">添加到主屏幕</p>
        <p className="text-[#888] text-[10px] mt-0.5">
          {isIOS
            ? '点击底部 分享按钮 → "添加到主屏幕"'
            : '获得全屏体验，告别浏览器地址栏'}
        </p>
      </div>
      {deferredPrompt ? (
        <button onClick={install} className="px-3 py-1.5 rounded-lg bg-[#d4a843] text-black text-xs font-bold flex-shrink-0">安装</button>
      ) : null}
      <button onClick={dismiss} className="text-[#555] text-lg flex-shrink-0">&times;</button>
    </div>
  )
}

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = useGameStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    const { emoji, color } = AVATARS[selectedIndex]
    const result = await login(username.trim(), password, `${emoji}:${color}`)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    }
  }

  return (
    <div className="h-dvh bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs flex flex-col gap-5"
      >
        {/* Logo */}
        <div className="text-center mb-2">
          <h1
            className="text-4xl font-black tracking-[0.15em] text-[#d4a843]"
            style={{ textShadow: '0 0 30px rgba(212,168,67,0.3)' }}
          >
            ALL IN
          </h1>
          <p className="text-[#555] text-xs mt-1">和朋友来一局德州</p>
        </div>

        {/* Avatar picker */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#8a7a5a] mb-2">选择头像</p>
          <div className="flex gap-2 justify-between">
            {AVATARS.map((av, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className="w-10 h-10 rounded-full text-lg flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  backgroundColor: av.color,
                  boxShadow: i === selectedIndex ? '0 0 0 2px #0a0a0a, 0 0 0 3px #d4a843' : 'none',
                  transform: i === selectedIndex ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {av.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Username */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#8a7a5a] mb-2">账户名</p>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="输入账户名..."
            maxLength={20}
            autoComplete="username"
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white placeholder-[#444] outline-none focus:border-[#b8860b] transition-colors text-sm"
          />
        </div>

        {/* Password */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#8a7a5a] mb-2">密码</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码..."
            autoComplete="current-password"
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white placeholder-[#444] outline-none focus:border-[#b8860b] transition-colors text-sm"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!username.trim() || !password || loading}
          className="w-full py-2.5 rounded-xl font-bold text-black bg-gradient-to-r from-[#b8860b] to-[#d4a843] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-sm"
        >
          {loading ? '登录中...' : '登录 / 注册'}
        </button>

        <p className="text-[10px] text-[#444] text-center">
          账户不存在时将自动注册
        </p>
      </form>
      <InstallBanner />
    </div>
  )
}
