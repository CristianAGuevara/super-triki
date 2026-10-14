import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import cors from 'cors'
import { createAdapter } from '@socket.io/redis-adapter'
import RedisClient from 'ioredis'
import type { ClientToServerEvents, ServerToClientEvents } from './types/socket.js'
import { registerGameHandler } from './handlers/gameHandler.js'

const PORT = process.env.PORT ?? 3001
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const API_PREFIX = process.env.API_PREFIX ?? (process.env.VERCEL ? '/api' : '')
const SOCKET_PATH = `${API_PREFIX}/socket.io` || '/socket.io'

const app = express()
app.use(cors({ origin: FRONTEND_URL }))
app.get(`${API_PREFIX}/health` || '/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

const httpServer = createServer(app)

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  path: SOCKET_PATH,
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
})

const REDIS_URL = process.env.REDIS_URL
const hasRoomStateRedis = Boolean(
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
)
let redisAdapterReady: Promise<boolean> = Promise.resolve(true)

if (REDIS_URL) {
  const pubClient = new RedisClient(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  })
  const subClient = pubClient.duplicate()
  pubClient.on('error', error => console.error('[redis:pub]', error.message))
  subClient.on('error', error => console.error('[redis:sub]', error.message))

  redisAdapterReady = Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient))
      console.log('[+] Socket.IO Redis adapter ready')
      return true
    })
    .catch(error => {
      console.error('[redis] Socket.IO adapter failed to initialize', error)
      return false
    })

  io.use((_socket, next) => {
    void redisAdapterReady.then(ready => {
      if (ready) next()
      else next(new Error('Redis Pub/Sub is unavailable'))
    })
  })
} else if (process.env.VERCEL) {
  console.error('[redis] REDIS_URL is missing; cross-instance Socket.IO broadcasts are disabled')
}

if (process.env.VERCEL && (!REDIS_URL || !hasRoomStateRedis)) {
  io.use((_socket, next) => {
    next(new Error('Realtime service is missing Redis configuration'))
  })
}

io.on('connection', socket => {
  console.log(`[+] ${socket.id}`)
  registerGameHandler(io, socket)
  socket.on('disconnect', () => console.log(`[-] ${socket.id}`))
})

httpServer.listen(PORT, () => {
  console.log(`super-triki-server listening on :${PORT}`)
})
