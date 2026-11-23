<template>
  <!-- Roughens ring edges and speckles the fill for the "Pizarra" theme. -->
  <svg class="app-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id="st-chalk" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.6" result="speckle" />
        <feComposite in="rough" in2="speckle" operator="in" />
      </filter>
      <!-- Same chalk, for the win line: a straight <line> has an empty
           bounding box, so the region is given in user units instead. -->
      <filter id="st-chalk-line" filterUnits="userSpaceOnUse" x="-70" y="-70" width="458" height="458">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.6" result="speckle" />
        <feComposite in="rough" in2="speckle" operator="in" />
      </filter>
    </defs>
  </svg>

  <div class="app-ambient" aria-hidden="true">
    <span class="app-ambient__ring app-ambient__ring--a" />
    <span class="app-ambient__ring app-ambient__ring--b" />
    <span class="app-ambient__ring app-ambient__ring--c" />
  </div>

  <header class="app-header" :class="{ 'app-header--spectator': isSpectatorRoute }">
    <RouterLink to="/" class="app-logo" aria-label="Super Triki, ir al inicio">
      <svg class="app-logo__mark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="24" class="app-logo__ring app-logo__ring--l" />
        <circle cx="32" cy="32" r="13.5" class="app-logo__ring app-logo__ring--m" />
        <circle cx="32" cy="32" r="6" class="app-logo__dot" />
      </svg>
      <span class="app-logo__text">
        <span class="app-logo__name">Super Triki</span>
        <span class="app-logo__tagline">triqui de anillos</span>
      </span>
    </RouterLink>

    <div class="header-tools">
      <span
        v-if="tvStore.enabled"
        class="tv-mode-badge"
        title="Modo TV activo: flechas para moverte, OK para seleccionar, sin cursor. Añade ?tv=0 a la URL para desactivarlo."
      >
        TV · OK
      </span>

      <div
        ref="audioControlsRoot"
        class="audio-controls"
        role="group"
        aria-label="Audio"
        @focusout="handleAudioFocusOut"
      >
        <button
          type="button"
          class="icon-btn"
          :class="{
            'icon-btn--off': audioStore.musicVolume <= 0,
            'icon-btn--active': musicPanelOpen,
          }"
          :aria-expanded="musicPanelOpen"
          aria-label="Ajustar volumen de música"
          title="Volumen de música"
          @click="toggleAudioPanel('music')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18V5l11-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
            <path v-if="audioStore.musicVolume <= 0" d="M3 3l18 18" class="icon-btn__slash" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          :class="{
            'icon-btn--off': audioStore.sfxVolume <= 0,
            'icon-btn--active': sfxPanelOpen,
          }"
          :aria-expanded="sfxPanelOpen"
          aria-label="Ajustar volumen de efectos"
          title="Volumen de efectos"
          @click="toggleAudioPanel('sfx')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <template v-if="audioStore.sfxVolume > 0">
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </template>
            <path v-else d="m16 9 5 6m0-6-5 6" />
          </svg>
        </button>

        <Transition name="audio-panel">
          <div
            v-if="musicPanelOpen || sfxPanelOpen"
            class="audio-panel"
            :class="{
              'audio-panel--music': musicPanelOpen && !sfxPanelOpen,
              'audio-panel--sfx': !musicPanelOpen && sfxPanelOpen,
              'audio-panel--both': musicPanelOpen && sfxPanelOpen,
            }"
            role="group"
            aria-label="Volúmenes de audio"
          >
            <div v-if="musicPanelOpen" class="audio-mixer audio-mixer--music">
              <span class="audio-mixer__label">Música</span>
              <div class="audio-mixer__slider">
                <input
                  class="audio-mixer__range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="audioStore.musicVolume"
                  :style="{ '--fill': `${audioStore.musicVolume * 100}%` }"
                  aria-label="Volumen de música"
                  @input="changeMusicVolume"
                />
              </div>
              <span class="audio-mixer__value">{{ volumePercent(audioStore.musicVolume) }}%</span>
            </div>
            <div v-if="sfxPanelOpen" class="audio-mixer audio-mixer--sfx">
              <span class="audio-mixer__label">Efectos</span>
              <div class="audio-mixer__slider">
                <input
                  class="audio-mixer__range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="audioStore.sfxVolume"
                  :style="{ '--fill': `${audioStore.sfxVolume * 100}%` }"
                  aria-label="Volumen de efectos"
                  @input="changeSfxVolume"
                />
              </div>
              <span class="audio-mixer__value">{{ volumePercent(audioStore.sfxVolume) }}%</span>
            </div>
          </div>
        </Transition>
      </div>

      <div ref="themeMenuRoot" class="theme-picker">
        <button
          class="icon-btn theme-toggle"
          aria-haspopup="menu"
          :aria-expanded="themeMenuOpen"
          aria-label="Cambiar tema de la interfaz"
          title="Tema de la interfaz"
          @click="toggleThemeMenu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.3-4-7.8-9-7.8z" />
            <circle cx="7.5" cy="11.5" r="1" />
            <circle cx="10.5" cy="7.5" r="1" />
            <circle cx="15" cy="7.5" r="1" />
          </svg>
        </button>

        <Transition name="theme-menu">
          <div v-if="themeMenuOpen" class="theme-menu" role="menu" aria-label="Temas">
            <span class="st-eyebrow theme-menu__title">Tema de la interfaz</span>
            <button
              v-for="option in themeStore.themes"
              :key="option.id"
              type="button"
              role="menuitemradio"
              class="theme-option"
              :class="{ 'theme-option--active': themeStore.theme === option.id }"
              :aria-checked="themeStore.theme === option.id"
              @click="selectTheme(option.id)"
            >
              <span class="theme-option__swatch" :class="`theme-option__swatch--${option.id}`" aria-hidden="true">
                <i :style="{ background: option.swatches[0] }" />
                <i :style="{ background: option.swatches[1] }" />
                <i :style="{ background: option.swatches[2] }" />
              </span>
              <span class="theme-option__copy">
                <strong>{{ option.label }}</strong>
                <small>{{ option.description }}</small>
              </span>
              <span v-if="themeStore.theme === option.id" class="theme-option__check" aria-hidden="true">✓</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>

  <ConnectionBanner />

  <Transition name="tv-hint">
    <div v-if="tvStore.hintVisible" class="tv-mode-hint" role="status">
      <strong>Modo TV</strong>
      <span>Flechas para moverte · OK para seleccionar</span>
    </div>
  </Transition>

  <RouterView v-slot="{ Component, route: viewRoute }">
    <Transition name="page" mode="out-in">
      <component :is="Component" :key="String(viewRoute.name)" />
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useThemeStore, type ThemeId } from '@/stores/themeStore'
import { useAudioStore } from '@/stores/audioStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useTvModeStore } from '@/stores/tvStore'
import { useTvNavigation } from '@/composables/useTvNavigation'
import { getSocket } from '@/services/socket'
import ConnectionBanner from '@/components/ConnectionBanner.vue'

const themeStore = useThemeStore()
const audioStore = useAudioStore()
const connectionStore = useConnectionStore()
const tvStore = useTvModeStore()
const route = useRoute()
const TV_HINT_KEY = 'st_tv_hint_seen'
useTvNavigation()
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

/**
 * The home page keeps no socket open (it polls the room list over HTTP), so
 * a closed socket there is the normal state, not something to repair. Once
 * the visitor acts, the socket becomes active and the watchdog takes over.
 */
function socketIdle(): boolean {
  return route.name === 'home' && !socket.active
}

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
  if (document.hidden || connectionStore.blocked || socketIdle()) return
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
  if (document.hidden) {
    audioStore.suspendForBackground()
    return
  }

  audioStore.resumeFromBackground()
  if (connectionStore.blocked || socketIdle()) return

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
  if (socketIdle()) {
    connectionStore.reset()
    return
  }
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

function handlePageHide() {
  audioStore.suspendForBackground()
}

function handlePageShow() {
  audioStore.resumeFromBackground()
  if (connectionStore.blocked || socketIdle()) return
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

const themeMenuOpen = ref(false)
const themeMenuRoot = ref<HTMLElement | null>(null)
const audioControlsRoot = ref<HTMLElement | null>(null)
const musicPanelOpen = ref(false)
const sfxPanelOpen = ref(false)

function toggleThemeMenu() {
  audioStore.playSfx('click')
  themeMenuOpen.value = !themeMenuOpen.value
}

function selectTheme(theme: ThemeId) {
  themeStore.setTheme(theme)
  audioStore.playSfx('select')
  themeMenuOpen.value = false
}

function closeThemeMenuOnOutside(event: Event) {
  if (!themeMenuOpen.value) return
  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') themeMenuOpen.value = false
    return
  }
  // With the pointer disabled every press lands on the page root; the menu
  // is then closed with Back/Escape or by choosing a theme.
  if (tvStore.enabled && tvStore.inputMode === 'dpad') return
  if (!themeMenuRoot.value?.contains(event.target as Node)) themeMenuOpen.value = false
}

function toggleAudioPanel(panel: 'music' | 'sfx') {
  audioStore.playSfx('click')
  if (panel === 'music') musicPanelOpen.value = !musicPanelOpen.value
  else sfxPanelOpen.value = !sfxPanelOpen.value
}

function closeAudioPanels() {
  musicPanelOpen.value = false
  sfxPanelOpen.value = false
}

function closeAudioPanelsOnOutside(event: Event) {
  if (!musicPanelOpen.value && !sfxPanelOpen.value) return
  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') closeAudioPanels()
    return
  }
  if (tvStore.enabled && tvStore.inputMode === 'dpad') return
  if (!audioControlsRoot.value?.contains(event.target as Node)) closeAudioPanels()
}

function handleAudioFocusOut(event: FocusEvent) {
  if (!musicPanelOpen.value && !sfxPanelOpen.value) return
  const next = event.relatedTarget as Node | null
  if (next && audioControlsRoot.value?.contains(next)) return
  closeAudioPanels()
}

function changeMusicVolume(event: Event) {
  audioStore.setMusicVolume(Number((event.target as HTMLInputElement).value))
}

function changeSfxVolume(event: Event) {
  audioStore.setSfxVolume(Number((event.target as HTMLInputElement).value))
}

function volumePercent(value: number): number {
  return Math.round(value * 100)
}

function activateAudio() {
  audioStore.startMusic()
  window.removeEventListener('pointerdown', activateAudio)
  window.removeEventListener('keydown', activateAudio)
}

onMounted(() => {
  if (tvStore.enabled) {
    try {
      if (!window.localStorage.getItem(TV_HINT_KEY)) {
        tvStore.showHint()
        window.localStorage.setItem(TV_HINT_KEY, '1')
      }
    } catch {
      tvStore.showHint()
    }
  }
  window.addEventListener('pointerdown', activateAudio)
  // A remote that sends real keys never produces a pointerdown.
  window.addEventListener('keydown', activateAudio)
  document.addEventListener('pointerdown', closeThemeMenuOnOutside)
  document.addEventListener('keydown', closeThemeMenuOnOutside)
  document.addEventListener('pointerdown', closeAudioPanelsOnOutside)
  document.addEventListener('keydown', closeAudioPanelsOnOutside)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
  connectionStore.setConnected(socket.connected)
  connectedAt = socket.connected ? Date.now() : 0
  // No connect here: each room, tournament and spectator view connects itself.
  schedulePlannedRotation()
  healthTimer = window.setInterval(checkConnection, HEALTH_INTERVAL_MS)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', activateAudio)
  window.removeEventListener('keydown', activateAudio)
  document.removeEventListener('pointerdown', closeThemeMenuOnOutside)
  document.removeEventListener('keydown', closeThemeMenuOnOutside)
  document.removeEventListener('pointerdown', closeAudioPanelsOnOutside)
  document.removeEventListener('keydown', closeAudioPanelsOnOutside)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('pagehide', handlePageHide)
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
@import '@/assets/base.css';
@import '@/assets/themes.css';
</style>

<style scoped>
.app-ambient {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.app-ambient__ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid var(--line-soft);
  opacity: 0.7;
}

.app-ambient__ring::after {
  content: '';
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  border: 1px solid var(--line-soft);
}

.app-ambient__ring--a {
  width: 70vmax;
  height: 70vmax;
  top: -38vmax;
  right: -30vmax;
  animation: ambient-drift 38s ease-in-out infinite alternate;
}

.app-ambient__ring--b {
  width: 46vmax;
  height: 46vmax;
  bottom: -26vmax;
  left: -18vmax;
  animation: ambient-drift 46s ease-in-out infinite alternate-reverse;
}

.app-ambient__ring--c {
  width: 18vmax;
  height: 18vmax;
  top: 48%;
  right: 6vw;
  border-width: 0.9vmax;
  border-color: color-mix(in srgb, var(--accent-secondary) 6%, transparent);
  animation: ambient-drift 30s ease-in-out infinite alternate;
}

.app-ambient__ring--c::after { display: none; }

@keyframes ambient-drift {
  from { transform: translate3d(0, 0, 0) rotate(0deg); }
  to { transform: translate3d(-3vmax, 4vmax, 0) rotate(40deg); }
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: calc(10px + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px));
  padding-left: max(clamp(16px, 4vw, 40px), env(safe-area-inset-left, 0px));
  padding-right: max(clamp(16px, 4vw, 40px), env(safe-area-inset-right, 0px));
  background: var(--header-bg);
  backdrop-filter: blur(14px) saturate(1.4);
  border-bottom: 1px solid var(--line-soft);
  transition: background 0.4s ease, border-color 0.4s ease;
}

.app-header--spectator {
  padding-top: calc(6px + env(safe-area-inset-top, 0px));
  padding-bottom: 6px;
}

.app-header--spectator .app-logo__mark { width: 26px; height: 26px; }
.app-header--spectator .app-logo__tagline { display: none; }

.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}

.app-logo__mark {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  overflow: visible;
}

.app-logo__ring {
  fill: none;
  transform-origin: 32px 32px;
  transition: transform 0.6s var(--ease-spring);
}

.app-logo__ring--l { stroke: var(--accent-primary); stroke-width: 6; }
.app-logo__ring--m { stroke: var(--accent-secondary); stroke-width: 5; }
.app-logo__dot { fill: var(--win-gold); }

.app-logo:hover .app-logo__ring--l { transform: rotate(90deg) scale(1.06); }
.app-logo:hover .app-logo__ring--m { transform: scale(0.86); }

.app-logo__text { display: flex; flex-direction: column; gap: 1px; }

.app-logo__name {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}

.app-logo__tagline {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tv-mode-badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid var(--accent-primary);
  border-radius: 999px;
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.tv-mode-hint {
  position: fixed;
  z-index: 520;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  display: flex;
  align-items: baseline;
  gap: 9px;
  max-width: calc(100vw - 32px);
  padding: 12px 18px;
  border: 1px solid var(--accent-primary);
  border-radius: 999px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-card);
  color: var(--text-secondary);
  font-size: 13px;
  transform: translateX(-50%);
}

.tv-mode-hint strong {
  color: var(--accent-primary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tv-hint-enter-active,
.tv-hint-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.tv-hint-enter-from,
.tv-hint-leave-to { opacity: 0; transform: translate(-50%, 10px); }

.audio-controls {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 3px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--surface-muted);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s var(--ease-spring);
}

.icon-btn:hover { background: var(--control-hover); color: var(--text-primary); }
.icon-btn:active { transform: scale(0.9); }
.icon-btn--off { color: var(--text-faint); }
.icon-btn--active {
  background: var(--control-hover);
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 55%, transparent);
}

.audio-panel {
  position: absolute;
  top: calc(100% + 10px);
  z-index: 70;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 11px 6px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-card), 0 20px 45px -18px rgba(0, 0, 0, 0.66);
  transform: translateX(-50%);
}

.audio-panel--music { left: 23.33%; }
.audio-panel--sfx { left: 76.67%; }
.audio-panel--both { left: 50%; }

.audio-mixer {
  --audio-color: var(--accent-primary);
  display: flex;
  width: 44px;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.audio-mixer--sfx { --audio-color: var(--accent-secondary); }

.audio-mixer__label {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.audio-mixer__slider {
  position: relative;
  width: 44px;
  height: 112px;
  /* Keep the page still while a finger drags the vertical volume control. */
  touch-action: none;
  overscroll-behavior: contain;
}

.audio-mixer__range {
  --fill: 60%;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 112px;
  height: 44px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
  touch-action: none;
  transform: translate(-50%, -50%) rotate(-90deg);
}

.audio-mixer__range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--audio-color) var(--fill), var(--line-strong) var(--fill));
}

.audio-mixer__range::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-top: -5px;
  appearance: none;
  border: 2px solid var(--surface-raised);
  border-radius: 50%;
  background: var(--text-primary);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
}

.audio-mixer__range::-moz-range-track {
  height: 6px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--audio-color) var(--fill), var(--line-strong) var(--fill));
}

.audio-mixer__range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid var(--surface-raised);
  border-radius: 50%;
  background: var(--text-primary);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
}

.audio-mixer__value {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
}

.audio-panel-enter-active,
.audio-panel-leave-active { transition: opacity 0.16s ease; }
.audio-panel-enter-from,
.audio-panel-leave-to { opacity: 0; }

.icon-btn svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-btn__slash { stroke: var(--accent-danger); }

.theme-toggle {
  border: 1px solid var(--line-soft);
  background: var(--surface-muted);
  width: 44px;
  height: 44px;
}

.app-defs { position: absolute; }

.theme-picker { position: relative; }

.theme-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 60;
  display: flex;
  width: min(320px, calc(100vw - 24px));
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: var(--surface-raised);
  box-shadow: var(--shadow-card), 0 24px 50px -20px rgba(0, 0, 0, 0.7);
}

.theme-menu__title { padding: 4px 8px 6px; }

.theme-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.theme-option:hover { background: var(--control-hover); }

.theme-option--active {
  border-color: var(--accent-primary);
  background: var(--control-bg);
}

.theme-option__swatch {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.theme-option__swatch i { position: absolute; border-radius: 50%; }
.theme-option__swatch i:nth-child(1) { inset: 0; border-radius: 12px; border: 1px solid var(--line-strong); }
.theme-option__swatch i:nth-child(2) { width: 26px; height: 26px; -webkit-mask: radial-gradient(farthest-side, transparent 58%, #000 60%); mask: radial-gradient(farthest-side, transparent 58%, #000 60%); }
.theme-option__swatch i:nth-child(3) { width: 9px; height: 9px; }

/* Each swatch previews its own theme, whichever one is active. */
.theme-option__swatch--pixel i { border-radius: 0 !important; }
.theme-option__swatch--pixel i:nth-child(2) { -webkit-mask: linear-gradient(#000, #000) center / 100% 100%, linear-gradient(#000, #000) center / 46% 46% no-repeat; -webkit-mask-composite: xor; mask: linear-gradient(#000, #000) center / 100% 100% exclude, linear-gradient(#000, #000) center / 46% 46% no-repeat; }
.theme-option__swatch--chalk i:nth-child(1) { border: 1.5px dashed rgba(243, 239, 226, 0.6); }
.theme-option__swatch--chalk i:nth-child(2) { -webkit-mask: radial-gradient(farthest-side, transparent 74%, #000 76%); mask: radial-gradient(farthest-side, transparent 74%, #000 76%); }

.theme-option__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 1px; }
.theme-option__copy strong { color: var(--text-primary); font-family: var(--font-display); font-size: 16px; }
.theme-option__copy small { color: var(--text-muted); font-size: 12.5px; line-height: 1.3; }
.theme-option__check { color: var(--accent-primary); font-weight: 900; }

.theme-menu-enter-active, .theme-menu-leave-active { transition: opacity 0.18s ease, transform 0.25s var(--ease-spring); transform-origin: top right; }
.theme-menu-enter-from, .theme-menu-leave-to { opacity: 0; transform: translateY(-6px) scale(0.96); }

@media (max-width: 560px) {
  .app-logo__tagline { display: none; }
  .header-tools { gap: 6px; }
  .audio-controls { padding: 3px; }
}

@media (max-width: 360px) {
  .app-logo__name { font-size: 16px; }
}
</style>
