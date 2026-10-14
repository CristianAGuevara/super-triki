import { randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'
import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from './types/socket.js'

const restUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const restToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

export const roomRedis = restUrl && restToken
  ? new Redis({ url: restUrl, token: restToken })
  : null

export const redisPrefix = `super-triki:${process.env.VERCEL_ENV ?? 'development'}`
export const roomIndexKey = `${redisPrefix}:rooms`
export const roomRedisEnabled = roomRedis !== null

interface RoomBusMessage {
  origin: string
  roomId: string
  event: keyof ServerToClientEvents
  payload: unknown
  exceptSocketId?: string
}

const instanceId = randomUUID()
const busChannel = `${redisPrefix}:socket-events`

function emitLocal(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  message: Omit<RoomBusMessage, 'origin'>,
) {
  const operator = message.exceptSocketId
    ? io.to(message.roomId).except(message.exceptSocketId)
    : io.to(message.roomId)
  operator.emit(message.event, message.payload as never)
}

export async function initializeRoomBus(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
): Promise<boolean> {
  if (!roomRedis) return false

  return new Promise(resolve => {
    let ready = false
    let retryDelay = 1_000

    const subscribe = () => {
      const subscriber = roomRedis.subscribe<RoomBusMessage>(busChannel)
      let retryScheduled = false
      subscriber.on('message', ({ message }) => {
        if (message.origin === instanceId) return
        emitLocal(io, message)
      })
      subscriber.on('subscribe', () => {
        retryDelay = 1_000
        if (!ready) {
          ready = true
          console.log('[+] Upstash REST event bus ready')
          resolve(true)
        }
      })
      subscriber.on('error', error => {
        console.error('[redis:subscribe]', error.message)
        if (retryScheduled) return
        retryScheduled = true
        void subscriber.unsubscribe().finally(() => {
          setTimeout(subscribe, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30_000)
        })
      })
    }

    subscribe()
  })
}

export async function emitRoomEvent(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
  event: keyof ServerToClientEvents,
  payload: unknown,
  exceptSocketId?: string,
): Promise<void> {
  const message: Omit<RoomBusMessage, 'origin'> = { roomId, event, payload, exceptSocketId }
  emitLocal(io, message)

  if (!roomRedis) return
  try {
    await roomRedis.publish(busChannel, { ...message, origin: instanceId })
  } catch (error) {
    console.error('[redis:publish]', error)
  }
}
