import { useState, useEffect, useCallback } from 'react'
import { Room, RoomEvent, Participant } from 'livekit-client'
import { useGameStore } from '../stores/game-store'

export function useVoice() {
  const [room] = useState(() => new Room())
  const [isMuted, setIsMuted] = useState(false)
  const [speakingParticipants, setSpeaking] = useState<Set<string>>(new Set())
  const [connected, setConnected] = useState(false)
  const gameRoom = useGameStore((s) => s.room)
  const playerId = useGameStore((s) => s.user?.id ?? null)

  const connect = useCallback(async () => {
    if (!gameRoom || !playerId) return
    try {
      const res = await fetch(`/api/rooms/${gameRoom.id}/voice-token?playerId=${playerId}&nickname=player`)
      const { token, wsUrl } = await res.json()
      if (!token || !wsUrl) return // LiveKit not configured, skip
      await room.connect(wsUrl, token)
      await room.localParticipant.setMicrophoneEnabled(true)
      setConnected(true)
    } catch (e) { console.warn('Voice connect failed:', e) }
  }, [room, gameRoom, playerId])

  const disconnect = useCallback(() => {
    room.disconnect()
    setConnected(false)
  }, [room])

  const toggleMute = useCallback(async () => {
    const newMuted = !isMuted
    await room.localParticipant.setMicrophoneEnabled(!newMuted)
    setIsMuted(newMuted)
  }, [room, isMuted])

  // Track speaking
  useEffect(() => {
    const handler = (speakers: Participant[]) => {
      setSpeaking(new Set(speakers.map((s) => s.identity)))
    }
    room.on(RoomEvent.ActiveSpeakersChanged, handler)
    return () => { room.off(RoomEvent.ActiveSpeakersChanged, handler) }
  }, [room])

  // Auto-connect when entering game room
  useEffect(() => {
    if (gameRoom && playerId) connect()
    return () => { disconnect() }
  }, [gameRoom?.id])

  return { connected, isMuted, toggleMute, speakingParticipants, connect, disconnect }
}
