import { useState } from 'react'
import { useGameStore } from '../stores/game-store'

interface ActionBarProps {
  mySeatIndex: number
}

export function ActionBar({ mySeatIndex }: ActionBarProps) {
  const { sendAction, currentTurn, currentBet, minRaise, room, playerId } = useGameStore()
  const isMyTurn = currentTurn === mySeatIndex

  const me = room?.players.find((p) => p.id === playerId)
  const myChips = me?.chips ?? 0

  // Find my current bet from hands
  const myHand = useGameStore.getState().hands.find((h) => h.seatIndex === mySeatIndex)
  const myBet = myHand?.bet ?? 0

  const pot = room?.game?.pot ?? 0

  const [raiseAmount, setRaiseAmount] = useState(minRaise)

  const canCheck = currentBet === myBet
  const callAmount = Math.min(currentBet - myBet, myChips)
  const effectiveMinRaise = Math.max(minRaise, currentBet - myBet + 1)
  const effectiveRaise = Math.max(raiseAmount, effectiveMinRaise)

  const halfPot = Math.max(effectiveMinRaise, Math.floor(pot / 2))
  const threeQuarterPot = Math.max(effectiveMinRaise, Math.floor((pot * 3) / 4))
  const fullPot = Math.max(effectiveMinRaise, pot)

  const handleRaise = () => {
    sendAction('raise', effectiveRaise)
  }

  const handleAllIn = () => {
    sendAction('all-in', myChips)
  }

  return (
    <div
      className="h-[25%] bg-black/90 backdrop-blur border-t border-white/[0.08] flex items-center px-3 gap-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Raise slider section */}
      {isMyTurn && (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-white/70">加注</span>
            <span className="text-yellow-400 font-bold">{effectiveRaise.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={effectiveMinRaise}
            max={myChips}
            value={effectiveRaise}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full accent-yellow-400 h-1.5"
          />
          <div className="flex gap-1">
            {[
              { label: '½ Pot', value: halfPot },
              { label: '¾ Pot', value: threeQuarterPot },
              { label: 'Pot', value: fullPot },
            ].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setRaiseAmount(value)}
                className="flex-1 py-0.5 text-[10px] rounded bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-1 gap-2 items-center justify-center">
        {/* Fold */}
        <button
          onClick={() => sendAction('fold')}
          disabled={!isMyTurn}
          className="flex-1 py-3 rounded-xl bg-zinc-700 text-zinc-300 font-semibold text-sm hover:bg-zinc-600 transition-colors disabled:opacity-30"
        >
          弃牌
        </button>

        {/* Check — only when canCheck */}
        {canCheck && (
          <button
            onClick={() => sendAction('check')}
            disabled={!isMyTurn}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors disabled:opacity-30"
          >
            过牌
          </button>
        )}

        {/* Call — only when there's a bet to match */}
        {!canCheck && callAmount > 0 && (
          <button
            onClick={() => sendAction('call')}
            disabled={!isMyTurn}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors disabled:opacity-30"
          >
            <span className="block">跟注</span>
            <span className="block text-xs opacity-80">{callAmount.toLocaleString()}</span>
          </button>
        )}

        {/* Raise */}
        <button
          onClick={handleRaise}
          disabled={!isMyTurn || myChips <= callAmount}
          className="flex-1 py-3 rounded-xl bg-gradient-to-b from-yellow-400 to-orange-500 text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          <span className="block">加注</span>
          <span className="block text-xs opacity-80">{effectiveRaise.toLocaleString()}</span>
        </button>

        {/* All In */}
        <button
          onClick={handleAllIn}
          disabled={!isMyTurn}
          className="flex-1 py-3 rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          <span className="block">ALL IN</span>
          <span className="block text-xs opacity-80">{myChips.toLocaleString()}</span>
        </button>
      </div>

      {/* Voice button */}
      <div className="flex flex-col items-center gap-0.5">
        <button className="w-10 h-10 rounded-full border-2 border-green-500 flex items-center justify-center text-lg hover:bg-green-500/20 transition-colors">
          🎙️
        </button>
        <span className="text-[10px] text-green-400">语音中</span>
      </div>
    </div>
  )
}
