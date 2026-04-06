import type { ClientEventName, ClientEvents, ServerEventName, ServerEvents, WSMessage } from '@texas-holdem/shared'

type EventHandler<E extends ServerEventName> = (data: ServerEvents[E]) => void

export class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Function>>()
  private playerId: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pendingMessages: string[] = []
  private hasConnectedBefore = false

  constructor(playerId: string) {
    this.playerId = playerId
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${location.host}/ws?playerId=${this.playerId}`
    this.ws = new WebSocket(url)
    this.ws.onopen = () => {
      // Flush pending messages
      for (const msg of this.pendingMessages) {
        this.ws?.send(msg)
      }
      this.pendingMessages = []
      // On reconnect (not first connect), re-join room from session
      if (this.hasConnectedBefore) {
        const raw = localStorage.getItem('texas-holdem-session')
        if (raw) {
          try {
            const session = JSON.parse(raw)
            this.ws?.send(JSON.stringify({
              event: 'join-room',
              data: { code: session.roomCode, nickname: session.nickname, avatar: session.avatar },
            }))
          } catch {}
        }
      }
      this.hasConnectedBefore = true
    }
    this.ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data)
      this.handlers.get(msg.event)?.forEach((h) => h(msg.data))
    }
    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 2000)
    }
    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  send<E extends ClientEventName>(event: E, data: ClientEvents[E]) {
    const msg = JSON.stringify({ event, data })
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg)
    } else {
      // Queue message to send when connected
      this.pendingMessages.push(msg)
    }
  }

  on<E extends ServerEventName>(event: E, handler: EventHandler<E>) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  getPlayerId() {
    return this.playerId
  }
}
