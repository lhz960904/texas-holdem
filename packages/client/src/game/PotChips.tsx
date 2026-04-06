import { useMemo } from 'react'

interface PotChipsProps {
  amount: number
  collecting?: { targetX: string; targetY: string } | null
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

export function PotChips({ amount, collecting }: PotChipsProps) {
  const flatChips = useMemo(() => {
    const result: { bg: string; idx: number }[] = []
    let remaining = amount
    let idx = 0
    for (const d of DENOMINATIONS) {
      const count = Math.min(Math.floor(remaining / d.value), 3)
      for (let i = 0; i < count; i++) {
        result.push({ bg: d.bg, idx })
        idx++
      }
      remaining -= count * d.value
    }
    if (result.length === 0 && amount > 0) {
      result.push({ bg: DENOMINATIONS[DENOMINATIONS.length - 1].bg, idx: 0 })
    }
    return result.slice(0, 8) // max 8 for pot
  }, [amount])

  const scatterPositions = useMemo(() => {
    return flatChips.map((_, i) => {
      const seed = 9999 + i // fixed seed for pot
      const rotation = (seededRandom(seed) - 0.5) * 30
      const offsetX = (seededRandom(seed + 1) - 0.5) * 20
      const offsetY = (seededRandom(seed + 2) - 0.5) * 16
      return { rotation, offsetX, offsetY }
    })
  }, [flatChips.length])

  if (amount <= 0) return null

  const collectStyle = collecting
    ? ({
        '--winner-x': collecting.targetX,
        '--winner-y': collecting.targetY,
        animation: 'potCollect 0.8s ease-in forwards',
      } as React.CSSProperties)
    : {}

  return (
    <div className="flex flex-col items-center" style={collectStyle}>
      {/* Pot amount label */}
      <div
        className="text-xs font-bold px-2 py-0.5 rounded-full mb-1 whitespace-nowrap"
        style={{
          color: '#ffd700',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,215,0,0.3)',
        }}
      >
        POT {amount.toLocaleString()}
      </div>
      {/* Scattered chip pile */}
      <div className="relative" style={{ width: '56px', height: '44px' }}>
        {flatChips.map((chip, i) => {
          const pos = scatterPositions[i]
          const stackOffset = Math.floor(i / 3) * 2
          return (
            <div
              key={i}
              className={`absolute w-5 h-5 rounded-full border-2 border-dashed border-white/50 ${chip.bg}`}
              style={{
                left: `${18 + (pos?.offsetX ?? 0)}px`,
                top: `${14 + (pos?.offsetY ?? 0) - stackOffset}px`,
                transform: `rotate(${pos?.rotation ?? 0}deg)`,
                boxShadow: '0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                zIndex: i,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
