const SOUNDS = {
  deal: '/sounds/card-deal.mp3',
  flip: '/sounds/card-flip.mp3',
  chips: '/sounds/chips.mp3',
  check: '/sounds/check.mp3',
  fold: '/sounds/fold.mp3',
  win: '/sounds/win.mp3',
  turnAlert: '/sounds/turn-alert.mp3',
  tick: '/sounds/tick.mp3',
} as const

class SoundManager {
  private cache = new Map<string, HTMLAudioElement>()
  private enabled = true

  preload() {
    for (const [key, src] of Object.entries(SOUNDS)) {
      const audio = new Audio(src)
      audio.preload = 'auto'
      this.cache.set(key, audio)
    }
  }

  play(name: keyof typeof SOUNDS) {
    if (!this.enabled) return
    const audio = this.cache.get(name)
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {}) // ignore autoplay restrictions
    }
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }
}

export const sounds = new SoundManager()
