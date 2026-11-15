import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import cors from 'cors'
import type { ClientToServerEvents, ServerToClientEvents } from './types/socket.js'
import { getPublicListings, registerGameHandler } from './handlers/gameHandler.js'
import type { PublicRoomInfo } from './types/socket.js'
import { initializeRoomBus, roomRedisEnabled } from './redis.js'

const PORT = process.env.PORT ?? 3001
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const API_PREFIX = process.env.API_PREFIX ?? (process.env.VERCEL ? '/api' : '')
const SOCKET_PATH = `${API_PREFIX}/socket.io` || '/socket.io'

const app = express()
app.use(cors({ origin: FRONTEND_URL }))
app.get(`${API_PREFIX}/health` || '/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// The home page reads the open rooms from here instead of holding a socket
// open. A short cache makes many visitors cost one lookup.
const ROOMS_CACHE_MS = 2_000
let roomsCache: { at: number; rooms: PublicRoomInfo[] } | null = null
let roomsPending: Promise<PublicRoomInfo[]> | null = null

app.get(`${API_PREFIX}/rooms`, async (_req, res) => {
  try {
    if (!roomsCache || Date.now() - roomsCache.at >= ROOMS_CACHE_MS) {
      roomsPending ??= getPublicListings().finally(() => { roomsPending = null })
      roomsCache = { at: Date.now(), rooms: await roomsPending }
    }
    res.set('Cache-Control', 'no-store').json(roomsCache.rooms)
  } catch (error) {
    console.error('[rooms:http]', error)
    res.status(503).json({ error: 'No se pudo leer la lista de salas' })
  }
})

const httpServer = createServer(app)

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  path: SOCKET_PATH,
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
  // Detect half-open connections sooner than the 25s/20s defaults. Combined
  // with the client watchdog this keeps rooms and clocks from waiting on a
  // socket that the network silently dropped.
  pingInterval: 10_000,
  pingTimeout: 20_000,
})

if (!roomRedisEnabled) {
  console.warn('[redis] Upstash REST credentials missing; using single-instance room state')
} else {
  void initializeRoomBus(io)
    .then(ready => {
      if (!ready) console.warn('[redis] Event bus not ready; local broadcasts remain available')
    })
    .catch(error => console.error('[redis] Room event bus failed to initialize', error))
}

io.on('connection', socket => {
  console.log(`[+] ${socket.id}`)
  registerGameHandler(io, socket)
  socket.on('disconnect', () => console.log(`[-] ${socket.id}`))
})

httpServer.listen(PORT, () => {
  console.log(`super-triki-server listening on :${PORT}`)
})
