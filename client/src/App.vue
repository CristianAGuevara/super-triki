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
import { useLobbyStore } from '@/stores/lobbyStore'
import { connectSocket, getSocket } from '@/services/socket'
import ConnectionBanner from '@/components/ConnectionBanner.vue'

const themeStore = useThemeStore()
const audioStore = useAudioStore()
const connectionStore = useConnectionStore()
const lobbyStore = useLobbyStore()
const route = useRoute()
const socket = getSocket()
const isSpectatorRoute = computed(() => route.name === 'spectate')
let healthTimer: number | undefined

function handleConnect() {
  connectionStore.setConnected(true)
}

function handleDisconnect(reason: string) {
  if (reason === 'io client disconnect') {
    connectionStore.setConnected(false)
    return
  }
  if (reason === 'io server disconnect') {
    connectionStore.setDisconnected(
      'La sesión se cerró; puede estar abierta en otra pestaña.',
      true,
    )
    return
  }
  connectionStore.setDisconnected()
}

function handleConnectError(error: Error) {
  connectionStore.setDisconnected('No se pudo conectar con el servidor')
  connectionStore.setError(error.message)
}

function handleReconnectAttempt(attempt: number) {
  connectionStore.setReconnecting(attempt)
}

function checkConnection() {
  if (document.hidden || connectionStore.blocked) return
  if (!socket.connected) {
    connectionStore.setDisconnected()
    socket.connect()
    return
  }

  let answered = false
  const timeout = window.setTimeout(() => {
    if (answered) return
    answered = true
    connectionStore.setDisconnected('La conexión dejó de responder')
    socket.disconnect()
    window.setTimeout(() => {
      connectionStore.setReconnecting()
      socket.connect()
    }, 200)
  }, 8_000)

  socket.emit('rooms:get', rooms => {
    if (answered) return
    answered = true
    window.clearTimeout(timeout)
    lobbyStore.setRooms(rooms)
    connectionStore.setConnected(true)
  })
}

function handleVisibilityChange() {
  if (document.hidden || connectionStore.blocked) return
  connectionStore.setConnected(socket.connected)
  if (!socket.connected) {
    connectionStore.setReconnecting()
    socket.connect()
  } else {
    checkConnection()
  }
}

function handleOnline() {
  if (connectionStore.blocked) return
  if (!socket.connected) {
    connectionStore.setReconnecting()
    socket.connect()
  } else {
    checkConnection()
  }
}

function handleOffline() {
  connectionStore.setDisconnected('Sin conexión a internet')
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
  connectionStore.setConnected(socket.connected)
  connectSocket()
  healthTimer = window.setInterval(checkConnection, 15_000)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', activateAudio)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  if (healthTimer !== undefined) window.clearInterval(healthTimer)
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

body {
  background-color: var(--page-bg);
  background-image: var(--page-gradient);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
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
