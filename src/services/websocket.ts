/**
 * StarHub WebSocket Client
 *
 * Manages a persistent WebSocket connection to the Cloudflare Worker
 * for real-time event push (sync progress, classify progress, etc.).
 */

type EventHandler = (data: any) => void

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30_000
const PING_INTERVAL_MS = 25_000

class WebSocketClient {
  private ws: WebSocket | null = null
  private url = ''
  private listeners = new Map<string, Set<EventHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0
  private intentionalClose = false
  private connectionPromise: Promise<void> | null = null
  private resolveConnection: (() => void) | null = null

  // ── Connection ──────────────────────────────────────────

  /** Connect to the WebSocket endpoint. Call once on app init. */
  connect(url?: string): void {
    // Use the provided URL, or infer from current location
    this.url = url || this.inferWsUrl()
    this.intentionalClose = false
    this.doConnect()
  }

  /** Disconnect and stop reconnecting. */
  disconnect(): void {
    this.intentionalClose = true
    this.clearTimers()
    if (this.ws) {
      this.ws.close(1000, 'client disconnect')
      this.ws = null
    }
  }

  /** Returns a promise that resolves when the next connection is established. */
  waitForConnection(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }
    if (!this.connectionPromise) {
      this.connectionPromise = new Promise((resolve) => {
        this.resolveConnection = resolve
      })
    }
    return this.connectionPromise
  }

  // ── Pub/Sub ─────────────────────────────────────────────

  /** Subscribe to a server-pushed event type. */
  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  /** Unsubscribe. */
  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  /** Send a typed message to the server. */
  send(type: string, payload?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[ws] not connected, cannot send:', type)
      return
    }
    this.ws.send(JSON.stringify({ type, payload: payload ?? {} }))
  }

  // ── Internals ───────────────────────────────────────────

  private inferWsUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}/ws`
  }

  private doConnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    this.clearTimers()

    try {
      this.ws = new WebSocket(this.url)
    } catch (err) {
      console.error('[ws] failed to create WebSocket:', err)
      this.scheduleReconnect()
      return
    }

    const ws = this.ws

    ws.onopen = () => {
      console.log('[ws] connected')
      this.reconnectAttempt = 0
      this.startPing()

      // Resolve any pending waitForConnection
      if (this.resolveConnection) {
        this.resolveConnection()
        this.connectionPromise = null
        this.resolveConnection = null
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        const { type, payload } = msg
        if (type) {
          this.emit(type, payload ?? {})
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = (event: CloseEvent) => {
      console.log(`[ws] disconnected (code=${event.code})`)
      this.clearTimers()
      if (!this.intentionalClose) {
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      // onclose will fire after this, so reconnect is handled there
    }
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data)
      } catch (err) {
        console.error(`[ws] handler error for "${event}":`, err)
      }
    })
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send('ping')
    }, PING_INTERVAL_MS)
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS
    )
    this.reconnectAttempt++
    console.log(`[ws] reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay)
  }
}

/** Singleton instance */
export const wsClient = new WebSocketClient()