import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import cors from 'cors'
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

io.on('connection', socket => {
  console.log(`[+] ${socket.id}`)
  registerGameHandler(io, socket)
  socket.on('disconnect', () => console.log(`[-] ${socket.id}`))
})

httpServer.listen(PORT, () => {
  console.log(`super-triki-server listening on :${PORT}`)
})
