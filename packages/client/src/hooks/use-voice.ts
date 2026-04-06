import { useState, useEffect, useCallback, useRef } from 'react'
import { Room, RoomEvent, type Participant } from 'livekit-client'
import { useGameStore } from '../stores/game-store'

export function useVoice() {
  const roomRef = useRef<Room | null>(null)
  const [isMuted, setIsMuted] = useState(true) // start muted
  const [speakingParticipants, setSpeaking] = useState<Set<string>>(new Set())
  const [connected, setConnected] = useState(false)
  const gameRoom = useGameStore((s) => s.room)
  const playerId = useGameStore((s) => s.user?.id ?? null)
  const nickname = useGameStore((s) => s.user?.nickname ?? 'player')
  const token = useGameStore((s) => s.token)

  const getRoom = useCallback(() => {
    if (!roomRef.current) roomRef.current = new Room()
    return roomRef.current
  }, [])

  const connect = useCallback(async () => {
    if (!gameRoom || !playerId) return
    try {
      const res = await fetch(
        `/api/rooms/${gameRoom.id}/voice-token?playerId=${playerId}&nickname=${encodeURIComponent(nickname)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      const { token: voiceToken, wsUrl } = await res.json()
      if (!voiceToken || !wsUrl) return // LiveKit not configured
      const lkRoom = getRoom()
      await lkRoom.connect(wsUrl, voiceToken)
      // Start muted — user can unmute via UI
      await lkRoom.localParticipant.setMicrophoneEnabled(false)
      setIsMuted(true)
      setConnected(true)
    } catch (e) { console.warn('Voice connect failed:', e) }
  }, [getRoom, gameRoom, playerId, nickname, token])

  const disconnect = useCallback(() => {
    const lkRoom = roomRef.current
    if (lkRoom) {
      lkRoom.disconnect()
      roomRef.current = null
    }
    setConnected(false)
    setIsMuted(true)
  }, [])

  const toggleMute = useCallback(async () => {
    const lkRoom = roomRef.current
    if (!lkRoom) return
    const newMuted = !isMuted
    await lkRoom.localParticipant.setMicrophoneEnabled(!newMuted)
    setIsMuted(newMuted)
  }, [isMuted])

  // Track active speakers
  useEffect(() => {
    const lkRoom = roomRef.current
    if (!lkRoom) return
    const handler = (speakers: Participant[]) => {
      setSpeaking(new Set(speakers.map((s) => s.identity)))
    }
    lkRoom.on(RoomEvent.ActiveSpeakersChanged, handler)
    return () => { lkRoom.off(RoomEvent.ActiveSpeakersChanged, handler) }
  }, [connected]) // re-attach when connection state changes

  // Auto-connect when entering game room
  useEffect(() => {
    if (gameRoom && playerId) connect()
    return () => { disconnect() }
  }, [gameRoom?.id])

  return { connected, isMuted, toggleMute, speakingParticipants, connect, disconnect }
}
