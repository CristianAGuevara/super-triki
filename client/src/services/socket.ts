import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let _socket: AppSocket | null = null

export function getSocket(): AppSocket {
  if (!_socket) {
    _socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
      autoConnect: false,
      transports: ['websocket'],
    })
  }
  return _socket
}

export function connectSocket(): void {
  getSocket().connect()
}

export function waitForSocketConnection(timeoutMs = 8_000): Promise<boolean> {
  const socket = getSocket()
  if (socket.connected) return Promise.resolve(true)

  return new Promise(resolve => {
    let settled = false
    let timeout: number
    const finish = (connected: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
      resolve(connected)
    }
    const onConnect = () => finish(true)
    const onError = () => finish(false)

    timeout = window.setTimeout(() => finish(false), timeoutMs)
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
    if (!socket.active) socket.connect()
  })
}

export function disconnectSocket(): void {
  _socket?.disconnect()
  _socket = null
}
