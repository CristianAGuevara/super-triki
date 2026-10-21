import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let _socket: AppSocket | null = null

export function getSocket(): AppSocket {
  if (!_socket) {
    const isLocal = typeof window === 'undefined' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    const serverUrl = import.meta.env.VITE_SERVER_URL ||
      (isLocal ? 'http://localhost:3001' : window.location.origin)
    const socketPath = import.meta.env.VITE_SOCKET_PATH ||
      (import.meta.env.VITE_SERVER_URL || isLocal ? '/socket.io' : '/api/socket.io')

    _socket = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      transports: ['websocket'],
      path: socketPath,
    })
  }
  return _socket
}

export function connectSocket(): void {
  getSocket().connect()
}

export function waitForSocketConnection(timeoutMs = 12_000): Promise<boolean> {
  const socket = getSocket()
  if (socket.connected) return Promise.resolve(true)

  return new Promise(resolve => {
    let settled = false
    const finish = (connected: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      socket.off('connect', onConnect)
      resolve(connected)
    }
    const onConnect = () => finish(true)
    const timeout = window.setTimeout(() => finish(false), timeoutMs)

    socket.once('connect', onConnect)
    // Keep listening across Socket.IO reconnection attempts. A transient
    // connect_error should not turn a cold start into a permanent failure.
    if (!socket.active) socket.connect()
  })
}

export function disconnectSocket(): void {
  _socket?.disconnect()
  _socket = null
}
