import { useMemo } from 'react'

interface ChipPileProps {
  amount: number
  seatIndex: number // used as seed for consistent random scatter
  position: { x: string; y: string } // CSS position (percentage, used as top/left)
  pushFrom?: { x: number; y: number } // direction chips slide FROM (px offset from player side)
  animate?: 'push-in' | 'collect' | null
  collectTarget?: { x: string; y: string }
}

const DENOMINATIONS = [
  { value: 1000, bg: 'bg-gradient-to-b from-yellow-400 to-amber-600' },
  { value: 100, bg: 'bg-zinc-700' },
  { value: 25, bg: 'bg-emerald-600' },
  { value: 5, bg: 'bg-red-600' },
  { value: 1, bg: 'bg-blue-600' },
]

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function getChipBreakdown(amount: number): { bg: string; count: number }[] {
  const chips: { bg: string; count: number }[] = []
  let remaining = amount
  for (const d of DENOMINATIONS) {
    const count = Math.min(Math.floor(remaining / d.value), 3)
    if (count > 0) {
      chips.push({ bg: d.bg, count })
      remaining -= count * d.value
    }
  }
  if (chips.length === 0 && amount > 0) {
    chips.push({ bg: DENOMINATIONS[DENOMINATIONS.length - 1].bg, count: 1 })
  }
  return chips
}

export function ChipPile({ amount, seatIndex, position, pushFrom, animate, collectTarget }: ChipPileProps) {
  const chips = useMemo(() => getChipBreakdown(amount), [amount])

  // Flatten chips into individual items for rendering
  const flatChips = useMemo(() => {
    const result: { bg: string; idx: number }[] = []
    let idx = 0
    for (const c of chips) {
      for (let i = 0; i < c.count; i++) {
        result.push({ bg: c.bg, idx })
        idx++
      }
    }
    return result.slice(0, 6) // max 6 visible chips
  }, [chips])

  // Generate consistent random scatter positions
  const scatterPositions = useMemo(() => {
    return flatChips.map((_, i) => {
      const seed = seatIndex * 100 + i
      const rotation = (seededRandom(seed) - 0.5) * 30 // -15 to +15 degrees
      const offsetX = (seededRandom(seed + 1) - 0.5) * 12 // -6 to +6 px
      const offsetY = (seededRandom(seed + 2) - 0.5) * 12
      return { rotation, offsetX, offsetY }
    })
  }, [flatChips.length, seatIndex])

  if (amount <= 0) return null

  const animationClass =
    animate === 'push-in'
      ? 'animate-chip-push-in'
      : animate === 'collect'
        ? 'animate-chip-collect'
        : ''

  const collectStyle =
    animate === 'collect' && collectTarget
      ? ({
          '--collect-x': collectTarget.x,
          '--collect-y': collectTarget.y,
        } as React.CSSProperties)
      : {}

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${animationClass}`}
      style={{
        top: position.y,
        left: position.x,
        '--push-x': pushFrom ? `${pushFrom.x}px` : '0',
        '--push-y': pushFrom ? `${pushFrom.y}px` : '0',
        ...collectStyle,
        ...(animate === 'collect' ? { animationFillMode: 'forwards' } : {}),
      } as React.CSSProperties}
    >
      {/* Scattered chip pile */}
      <div className="relative" style={{ width: '40px', height: '36px' }}>
        {flatChips.map((chip, i) => {
          const pos = scatterPositions[i]
          // Stack every 2-3 chips with vertical offset
          const stackOffset = Math.floor(i / 2) * 2
          return (
            <div
              key={i}
              className={`absolute w-5 h-5 rounded-full border-2 border-dashed border-white/50 ${chip.bg}`}
              style={{
                left: `${10 + (pos?.offsetX ?? 0)}px`,
                top: `${10 + (pos?.offsetY ?? 0) - stackOffset}px`,
                transform: `rotate(${pos?.rotation ?? 0}deg)`,
                boxShadow: '0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                zIndex: i,
              }}
            />
          )
        })}
      </div>
      {/* Amount label */}
      <div
        className="text-[10px] font-bold text-center px-1.5 py-0.5 rounded-full whitespace-nowrap -mt-1"
        style={{
          color: '#ffd700',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,215,0,0.3)',
        }}
      >
        {amount.toLocaleString()}
      </div>
    </div>
  )
}
