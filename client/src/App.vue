<template>
  <header class="app-header" :class="{ 'app-header--spectator': isSpectatorRoute }">
    <RouterLink to="/" class="app-logo">
      <img src="/favicon.svg" alt="Super Triki" class="app-logo__img" />
      <span>
        <span class="app-logo__name">Super Triki</span>
        <span class="app-logo__tagline">STRATEGY // PLAY</span>
      </span>
    </RouterLink>

    <div class="header-tools">
      <div class="audio-control" role="group" aria-label="Control de sonido">
        <button
          class="audio-control__mute"
          :aria-label="audioStore.muted ? 'Activar sonido' : 'Silenciar sonido'"
          @click="audioStore.toggleMute"
        >
          {{ audioStore.muted ? '🔇' : '🔊' }}
        </button>
        <input
          class="audio-control__range"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="audioStore.volume"
          aria-label="Volumen"
          @input="setVolume"
        />
        <span class="audio-control__value">{{ Math.round(audioStore.volume * 100) }}%</span>
      </div>

      <div class="theme-switcher" role="group" aria-label="Tema visual">
      <button
        v-for="option in themeStore.themes"
        :key="option.id"
        class="theme-switcher__button"
        :class="{ 'theme-switcher__button--active': themeStore.theme === option.id }"
        :aria-label="`Usar tema ${option.label}`"
        :title="option.label"
        :aria-pressed="themeStore.theme === option.id"
        @click="selectTheme(option.id)"
      >
        <span aria-hidden="true">{{ option.icon }}</span>
        <span class="theme-switcher__label">{{ option.label }}</span>
      </button>
      </div>
    </div>
  </header>

  <ConnectionBanner />
  <RouterView />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'
import { useAudioStore } from '@/stores/audioStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { connectSocket, getSocket } from '@/services/socket'
import ConnectionBanner from '@/components/ConnectionBanner.vue'

const themeStore = useThemeStore()
const audioStore = useAudioStore()
const connectionStore = useConnectionStore()
const route = useRoute()
const socket = getSocket()
const isSpectatorRoute = computed(() => route.name === 'spectate')
function envNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const ROTATION_BASE_MS = envNumber(import.meta.env.VITE_SOCKET_ROTATE_MS, 210_000)
const ROTATION_JITTER_MS = envNumber(import.meta.env.VITE_SOCKET_ROTATE_JITTER_MS, 30_000)
const ROTATION_SAFETY_MS = 3_500
const ROTATION_RECONNECT_DELAY_MS = 50
const RESTART_DELAY_MS = 200
const DISCONNECT_BANNER_DELAY_MS = 1_500
const HEALTH_INTERVAL_MS = 10_000
const HEALTH_TIMEOUT_MS = 6_000
let healthTimer: number | undefined
let rotationTimer: number | undefined
let rotationSafetyTimer: number | undefined
let rotationReconnectTimer: number | undefined
let restartTimer: number | undefined
let disconnectBannerTimer: number | undefined
let connectedAt = 0
let rotationStartedAt = 0
let healthCheckInFlight = false
let healthCheckSeq = 0

function clearTimer(timer: number | undefined): undefined {
  if (timer !== undefined) window.clearTimeout(timer)
  return undefined
}

function invalidateHealthCheck() {
  healthCheckSeq += 1
  healthCheckInFlight = false
}

function forceSocketRestart(message: string | null = null) {
  if (connectionStore.blocked) return

  invalidateHealthCheck()
  rotationSafetyTimer = clearTimer(rotationSafetyTimer)
  rotationReconnectTimer = clearTimer(rotationReconnectTimer)
  restartTimer = clearTimer(restartTimer)
  connectedAt = 0
  rotationStartedAt = 0
  connectionStore.setRotating(false)
  connectionStore.setDisconnected(message)

  socket.disconnect()
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  restartTimer = window.setTimeout(() => {
    if (connectionStore.blocked) return
    connectionStore.setReconnecting()
    socket.connect()
  }, RESTART_DELAY_MS)
}

function schedulePlannedRotation() {
  rotationTimer = clearTimer(rotationTimer)
  if (!socket.connected || connectionStore.blocked) return

  const delay = ROTATION_BASE_MS + Math.floor(Math.random() * ROTATION_JITTER_MS)
  rotationTimer = window.setTimeout(rotateConnection, delay)
}

function rotateConnection() {
  if (!socket.connected || connectionStore.blocked || connectionStore.rotating) return
  if (document.hidden) {
    rotationTimer = window.setTimeout(rotateConnection, 15_000)
    return
  }

  connectionStore.setRotating(true)
  rotationStartedAt = Date.now()
  rotationReconnectTimer = clearTimer(rotationReconnectTimer)
  rotationSafetyTimer = clearTimer(rotationSafetyTimer)
  rotationSafetyTimer = window.setTimeout(() => {
    if (socket.connected) return
    forceSocketRestart('La reconexión programada tardó demasiado')
  }, ROTATION_SAFETY_MS)

  socket.disconnect()
  rotationReconnectTimer = window.setTimeout(() => {
    if (connectionStore.blocked) return
    if (!socket.connected) socket.connect()
  }, ROTATION_RECONNECT_DELAY_MS)
}

function scheduleDisconnectBanner(
  message: string | null = null,
  shouldBlock = false,
) {
  disconnectBannerTimer = clearTimer(disconnectBannerTimer)
  if (shouldBlock) {
    connectionStore.setDisconnected(message, true)
    return
  }

  disconnectBannerTimer = window.setTimeout(() => {
    if (!socket.connected && !connectionStore.rotating) {
      connectionStore.setDisconnected(message)
    }
  }, DISCONNECT_BANNER_DELAY_MS)
}

function handleConnect() {
  invalidateHealthCheck()
  rotationSafetyTimer = clearTimer(rotationSafetyTimer)
  rotationReconnectTimer = clearTimer(rotationReconnectTimer)
  restartTimer = clearTimer(restartTimer)
  disconnectBannerTimer = clearTimer(disconnectBannerTimer)
  rotationStartedAt = 0
  connectionStore.setConnected(true)
  connectedAt = Date.now()
  schedulePlannedRotation()
}

function handleDisconnect(reason: string) {
  invalidateHealthCheck()
  rotationTimer = clearTimer(rotationTimer)
  disconnectBannerTimer = clearTimer(disconnectBannerTimer)
  connectionStore.setConnected(false)
  connectedAt = 0

  if (connectionStore.rotating) return

  if (reason === 'io client disconnect') return
  if (reason === 'io server disconnect') {
    scheduleDisconnectBanner(
      'La sesión se cerró; puede estar abierta en otra pestaña.',
      true,
    )
    return
  }
  scheduleDisconnectBanner()
}

function handleConnectError(error: Error) {
  connectionStore.setError(error.message)
  if (connectionStore.rotating) return
  connectionStore.setAttempts(Math.max(1, connectionStore.attempts))
  scheduleDisconnectBanner('No se pudo conectar con el servidor')
}

function handleReconnectAttempt(attempt: number) {
  connectionStore.setAttempts(attempt)
  if (!connectionStore.rotating) scheduleDisconnectBanner()
}

function checkConnection() {
  if (document.hidden || connectionStore.blocked) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    connectionStore.setDisconnected('Sin conexión a internet')
    return
  }

  if (connectionStore.rotating) {
    if (!socket.connected && Date.now() - rotationStartedAt >= ROTATION_SAFETY_MS) {
      forceSocketRestart('La reconexión programada no terminó')
    }
    return
  }

  if (!socket.connected) {
    connectionStore.setReconnecting()
    socket.connect()
    return
  }
  if (healthCheckInFlight) return

  healthCheckInFlight = true
  const checkId = ++healthCheckSeq
  let answered = false
  const finish = (force: boolean) => {
    if (answered || checkId !== healthCheckSeq) return
    answered = true
    healthCheckInFlight = false
    if (force) {
      forceSocketRestart('La conexión dejó de responder')
      return
    }
    connectionStore.setConnected(true)
  }

  const timeout = window.setTimeout(() => {
    finish(true)
  }, HEALTH_TIMEOUT_MS)

  socket.emit('connection:ping', result => {
    if (answered || checkId !== healthCheckSeq) return
    window.clearTimeout(timeout)
    if (!result?.ok) {
      finish(true)
      return
    }
    finish(false)
  })
}

function handleVisibilityChange() {
  if (document.hidden || connectionStore.blocked) return

  if (connectionStore.rotating) {
    if (!socket.connected) {
      forceSocketRestart('La reconexión programada no terminó')
    } else {
      connectionStore.setConnected(true)
      schedulePlannedRotation()
    }
    return
  }

  connectionStore.setConnected(socket.connected)
  if (!socket.connected) {
    connectionStore.setReconnecting()
    socket.connect()
  } else {
    if (connectedAt && Date.now() - connectedAt >= ROTATION_BASE_MS) {
      rotateConnection()
    } else {
      checkConnection()
    }
  }
}

function handleOnline() {
  if (connectionStore.blocked) return

  if (connectionStore.rotating) {
    if (!socket.connected) {
      forceSocketRestart('La reconexión programada no terminó')
    } else {
      connectionStore.setConnected(true)
      schedulePlannedRotation()
    }
    return
  }

  if (!socket.connected) {
    connectionStore.setReconnecting()
    socket.connect()
  } else {
    checkConnection()
  }
}

function handleOffline() {
  rotationTimer = clearTimer(rotationTimer)
  rotationSafetyTimer = clearTimer(rotationSafetyTimer)
  rotationReconnectTimer = clearTimer(rotationReconnectTimer)
  restartTimer = clearTimer(restartTimer)
  rotationStartedAt = 0
  connectionStore.setRotating(false)
  connectionStore.setDisconnected('Sin conexión a internet')
  socket.disconnect()
}

function handlePageShow() {
  if (connectionStore.blocked) return
  if (!socket.connected) {
    connectionStore.setReconnecting()
    socket.connect()
  } else {
    checkConnection()
  }
}

socket.on('connect', handleConnect)
socket.on('disconnect', handleDisconnect)
socket.on('connect_error', handleConnectError)
socket.io.on('reconnect_attempt', handleReconnectAttempt)

function selectTheme(theme: 'neon' | 'sunset') {
  audioStore.playSfx('click')
  themeStore.setTheme(theme)
}

function activateAudio() {
  audioStore.startMusic()
  window.removeEventListener('pointerdown', activateAudio)
}

function setVolume(event: Event) {
  audioStore.setVolume(Number((event.target as HTMLInputElement).value))
}

onMounted(() => {
  window.addEventListener('pointerdown', activateAudio)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('pageshow', handlePageShow)
  connectionStore.setConnected(socket.connected)
  connectedAt = socket.connected ? Date.now() : 0
  connectSocket()
  schedulePlannedRotation()
  healthTimer = window.setInterval(checkConnection, HEALTH_INTERVAL_MS)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', activateAudio)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('pageshow', handlePageShow)
  if (healthTimer !== undefined) window.clearInterval(healthTimer)
  rotationTimer = clearTimer(rotationTimer)
  rotationSafetyTimer = clearTimer(rotationSafetyTimer)
  rotationReconnectTimer = clearTimer(rotationReconnectTimer)
  restartTimer = clearTimer(restartTimer)
  disconnectBannerTimer = clearTimer(disconnectBannerTimer)
  socket.off('connect', handleConnect)
  socket.off('disconnect', handleDisconnect)
  socket.off('connect_error', handleConnectError)
  socket.io.off('reconnect_attempt', handleReconnectAttempt)
})
</script>

<style>
@import '@/assets/variables.css';

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

::selection {
  background: color-mix(in srgb, var(--accent-primary) 32%, transparent);
  color: var(--text-primary);
}

:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

body {
  background-color: var(--page-bg);
  background-image: var(--page-gradient);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  transition: background-color 0.35s ease, color 0.35s ease;
}
</style>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px clamp(16px, 4vw, 40px);
  background: var(--header-bg);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line-soft);
  transition: background 0.35s ease, border-color 0.35s ease;
}

.app-header--spectator {
  padding-top: 6px;
  padding-bottom: 6px;
}

.app-header--spectator .app-logo__img { width: 22px; height: 22px; }
.app-header--spectator .app-logo__tagline { display: none; }
.app-header--spectator .audio-control { transform: scale(0.9); transform-origin: right center; }

.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.app-logo > span { display: flex; flex-direction: column; gap: 1px; }

.app-logo__img {
  width: 28px;
  height: 28px;
}

.app-logo__name {
  font-size: 16px;
  font-weight: 800;
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
}

.app-logo__tagline {
  color: var(--text-muted);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.8px;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-control {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 126px;
  padding: 4px 8px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-muted);
}

.audio-control__mute {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
}

.audio-control__range {
  width: 58px;
  accent-color: var(--accent-primary);
  cursor: pointer;
}

.audio-control__value {
  min-width: 28px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  text-align: right;
}

.theme-switcher {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-muted);
  box-shadow: var(--shadow-card);
}

.theme-switcher__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  padding: 7px 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.theme-switcher__button:hover { color: var(--text-primary); transform: translateY(-1px); }
.theme-switcher__button--active {
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

@media (max-width: 520px) {
  .app-logo__tagline { display: none; }
  .theme-switcher__label { display: none; }
  .theme-switcher__button { padding: 7px 9px; font-size: 14px; }
  .header-tools { gap: 5px; }
  .audio-control { min-width: auto; padding: 4px; }
  .audio-control__range, .audio-control__value { display: none; }
}
</style>
