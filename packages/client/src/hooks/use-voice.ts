import { useState, useEffect, useCallback, useRef } from 'react'
import { Room, RoomEvent, Track, type Participant, type RemoteTrackPublication } from 'livekit-client'
import { useGameStore } from '../stores/game-store'

/** Pre-request mic permission before entering fullscreen game. Call from WaitingRoom. */
export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(t => t.stop())
    console.log('[Voice] mic permission granted')
    return true
  } catch (e) {
    console.warn('[Voice] mic permission denied:', e)
    return false
  }
}

export function useVoice() {
  const roomRef = useRef<Room | null>(null)
  const [isMuted, setIsMuted] = useState(true) // mic off by default
  const [isDeafened, setIsDeafened] = useState(false) // speaker on by default
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
    if (!gameRoom || !playerId) {
      console.log('[Voice] skip: no room or player', { roomId: gameRoom?.id, playerId })
      return
    }
    try {
      const url = `/api/rooms/${gameRoom.id}/voice-token?playerId=${playerId}&nickname=${encodeURIComponent(nickname)}`
      console.log('[Voice] fetching token:', url)
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      console.log('[Voice] token response:', { hasToken: !!data.token, wsUrl: data.wsUrl })
      if (!data.token || !data.wsUrl) return // LiveKit not configured
      const lkRoom = getRoom()
      await lkRoom.connect(data.wsUrl, data.token)
      console.log('[Voice] connected to LiveKit')
      await lkRoom.localParticipant.setMicrophoneEnabled(false)
      setIsMuted(true)
      setConnected(true)
    } catch (e) { console.warn('[Voice] connect failed:', e) }
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
    try {
      await lkRoom.localParticipant.setMicrophoneEnabled(!newMuted)
      setIsMuted(newMuted)
      console.log('[Voice] mic:', newMuted ? 'muted' : 'unmuted')
    } catch (e) {
      console.warn('[Voice] toggleMute failed:', e)
    }
  }, [isMuted])

  const toggleDeafen = useCallback(() => {
    const newDeafened = !isDeafened
    // Mute/unmute all remote audio elements
    document.querySelectorAll<HTMLAudioElement>('[id^="voice-"]').forEach((el) => {
      el.muted = newDeafened
    })
    setIsDeafened(newDeafened)
    console.log('[Voice] speaker:', newDeafened ? 'off' : 'on')
  }, [isDeafened])

  // Attach remote audio tracks to DOM for playback
  useEffect(() => {
    const lkRoom = roomRef.current
    if (!lkRoom) return

    const attachTrack = (pub: RemoteTrackPublication) => {
      if (pub.kind !== Track.Kind.Audio || !pub.track) return
      const el = pub.track.attach()
      el.id = `voice-${pub.trackSid}`
      el.muted = isDeafened // respect current deafen state
      document.body.appendChild(el)
      console.log('[Voice] attached remote audio track:', pub.trackSid)
    }
    const detachTrack = (pub: RemoteTrackPublication) => {
      if (pub.kind !== Track.Kind.Audio) return
      const el = document.getElementById(`voice-${pub.trackSid}`)
      if (el) el.remove()
      pub.track?.detach()
      console.log('[Voice] detached remote audio track:', pub.trackSid)
    }

    lkRoom.on(RoomEvent.TrackSubscribed, (_track, pub) => attachTrack(pub))
    lkRoom.on(RoomEvent.TrackUnsubscribed, (_track, pub) => detachTrack(pub))

    // Attach any already-subscribed tracks
    lkRoom.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.isSubscribed) attachTrack(pub)
      })
    })

    return () => {
      lkRoom.off(RoomEvent.TrackSubscribed, attachTrack as any)
      lkRoom.off(RoomEvent.TrackUnsubscribed, detachTrack as any)
      document.querySelectorAll('[id^="voice-"]').forEach((el) => el.remove())
    }
  }, [connected])

  // Track active speakers
  useEffect(() => {
    const lkRoom = roomRef.current
    if (!lkRoom) return
    const handler = (speakers: Participant[]) => {
      setSpeaking(new Set(speakers.map((s) => s.identity)))
    }
    lkRoom.on(RoomEvent.ActiveSpeakersChanged, handler)
    return () => { lkRoom.off(RoomEvent.ActiveSpeakersChanged, handler) }
  }, [connected])

  // Auto-connect when entering game room
  useEffect(() => {
    if (gameRoom && playerId) connect()
    return () => { disconnect() }
  }, [gameRoom?.id])

  return { connected, isMuted, isDeafened, toggleMute, toggleDeafen, speakingParticipants, connect, disconnect }
}
