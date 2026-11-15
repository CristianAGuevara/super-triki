import type { PublicRoomInfo } from '@/types/socket'
import { serverEndpoint } from './socket'

const REQUEST_TIMEOUT_MS = 3_500

/** The server's HTTP listing sits next to its Socket.IO path. */
function roomsUrl(): string {
  const { serverUrl, socketPath } = serverEndpoint()
  const prefix = socketPath.replace(/\/socket\.io\/?$/, '')
  return `${serverUrl.replace(/\/$/, '')}${prefix}/rooms`
}

/**
 * Reads the open rooms and tournaments without a socket.
 * Returns null when the request fails, so the caller keeps its last list.
 */
export async function fetchPublicRooms(): Promise<PublicRoomInfo[] | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(roomsUrl(), { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) return null
    const rooms: unknown = await response.json()
    return Array.isArray(rooms) ? rooms as PublicRoomInfo[] : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}
