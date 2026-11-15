<!--
  Floating emote button. Pressing it fans the emotes out in a half circle;
  sending one locks them all for a few seconds. The buzz sits in the middle
  of the fan with its own, longer cooldown, and only works during a match.
  Cooldowns are shown as a ring that fills up, never as a number.
-->
<template>
  <div
    ref="root"
    class="emote-wheel"
    :class="{ 'emote-wheel--open': open, 'emote-wheel--cooling': cooling }"
    :style="{ '--piece-color': color }"
  >
    <div class="emote-wheel__fan" :aria-hidden="!open">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="emote-wheel__item"
        :class="{ 'emote-wheel__item--buzz': item.id === 'buzz', 'emote-wheel__item--off': item.off }"
        :style="item.style"
        :tabindex="open ? 0 : -1"
        :disabled="!open || sending || item.off"
        :aria-label="item.label"
        :title="item.label"
        @click="send(item.id)"
      >
        <svg
          v-if="item.id === 'buzz' && buzzCooling"
          class="emote-wheel__ring"
          viewBox="0 0 36 36"
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="16" pathLength="1" :style="{ strokeDashoffset: 1 - buzzProgress }" />
        </svg>
        <span class="emote-wheel__face"><TrikiEmote :emote="item.id" /></span>
      </button>
    </div>

    <button
      type="button"
      class="emote-wheel__toggle"
      :aria-expanded="open"
      :aria-label="toggleLabel"
      :title="toggleLabel"
      @click="toggle"
    >
      <svg v-if="cooling" class="emote-wheel__ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="16" pathLength="1" :style="{ strokeDashoffset: 1 - cooldownProgress }" />
      </svg>
      <span class="emote-wheel__face">
        <TrikiEmote :emote="open ? 'cool' : 'happy'" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { EmoteId, GameControlAck } from '@/types/socket'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import { useAudioStore } from '@/stores/audioStore'
import { useTvModeStore } from '@/stores/tvStore'
import { BUZZ_COOLDOWN_MS, EMOTE_COOLDOWN_MS, EMOTES, useEmoteStore } from '@/stores/emoteStore'
import TrikiEmote from './TrikiEmote.vue'

/** Distance from the button to each emote, and the half circle they span. */
const RADIUS = 118
const ARC_START = 90
const ARC_END = 270

const store = useEmoteStore()
const gameStore = useGameStore()
const roomStore = useRoomStore()
const audioStore = useAudioStore()
const tvStore = useTvModeStore()

const props = defineProps<{
  /** Sends the emote to the room (the view owns the socket). */
  sendEmote: (emote: EmoteId) => Promise<GameControlAck>
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const sending = ref(false)
const now = ref(Date.now())
let ticker: number | null = null

const color = computed(() =>
  roomStore.mySlot ? gameStore.playerMeta[roomStore.mySlot]?.color : undefined
)

function progress(until: number, total: number): number {
  return Math.min(1, Math.max(0, 1 - (until - now.value) / total))
}

const cooling = computed(() => store.cooldownUntil > now.value)
const cooldownProgress = computed(() => progress(store.cooldownUntil, EMOTE_COOLDOWN_MS))
const buzzCooling = computed(() => store.buzzCooldownUntil > now.value)
const buzzProgress = computed(() => progress(store.buzzCooldownUntil, BUZZ_COOLDOWN_MS))

/** The buzz only exists while a match is being played, not in the waiting room. */
const inMatch = computed(() => roomStore.phase === 'playing' && !gameStore.isGameOver)

const toggleLabel = computed(() => {
  if (open.value) return 'Cerrar emotes'
  return cooling.value ? 'Emotes recargando' : 'Abrir emotes'
})

const buzzLabel = computed(() => {
  if (!inMatch.value) return 'Zumbido: disponible durante la partida'
  if (buzzCooling.value) return 'Zumbido recargando'
  return 'Zumbido: sacude la pantalla de los demás'
})

const items = computed(() => {
  // Seven seats on the arc; the buzz takes the middle one.
  const seats: Array<{ id: EmoteId; label: string; off: boolean }> = [
    ...EMOTES.slice(0, 3).map(emote => ({ ...emote, off: cooling.value })),
    { id: 'buzz', label: buzzLabel.value, off: !inMatch.value || buzzCooling.value },
    ...EMOTES.slice(3).map(emote => ({ ...emote, off: cooling.value })),
  ]
  const step = (ARC_END - ARC_START) / (seats.length - 1)
  return seats.map((seat, index) => {
    const angle = ((ARC_START + step * index) * Math.PI) / 180
    return {
      ...seat,
      style: {
        '--x': `${Math.round(Math.cos(angle) * RADIUS)}px`,
        '--y': `${Math.round(-Math.sin(angle) * RADIUS)}px`,
        '--delay': `${index * 28}ms`,
      },
    }
  })
})

function toggle() {
  open.value = !open.value
  audioStore.playSfx('click')
  if (open.value) {
    void nextTick(() => {
      root.value?.querySelector<HTMLElement>('.emote-wheel__item:not(:disabled)')?.focus({ preventScroll: true })
    })
  }
}

async function send(emote: EmoteId) {
  if (sending.value || !roomStore.roomId) return
  const isBuzz = emote === 'buzz'
  if (isBuzz ? (!inMatch.value || buzzCooling.value) : cooling.value) return

  sending.value = true
  open.value = false
  // Lock right away; undone below if the server refuses.
  if (isBuzz) store.startBuzzCooldown()
  else store.startCooldown()

  const result = await props.sendEmote(emote)
  sending.value = false
  if (!result.ok) {
    if (isBuzz) store.clearBuzzCooldown()
    else store.clearCooldown()
    audioStore.playSfx('error')
  }
}

function closeOnOutside(event: Event) {
  if (!open.value) return
  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') open.value = false
    return
  }
  // With the TV pointer disabled every press lands on the page root.
  if (tvStore.enabled && tvStore.inputMode === 'dpad') return
  if (!root.value?.contains(event.target as Node)) open.value = false
}

watch(() => cooling.value || buzzCooling.value, active => {
  if (active && !ticker) {
    ticker = window.setInterval(() => { now.value = Date.now() }, 100)
  } else if (!active && ticker) {
    window.clearInterval(ticker)
    ticker = null
  }
}, { immediate: true })

watch(() => [store.cooldownUntil, store.buzzCooldownUntil], () => { now.value = Date.now() })

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutside)
  document.addEventListener('keydown', closeOnOutside)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeOnOutside)
  document.removeEventListener('keydown', closeOnOutside)
  if (ticker) window.clearInterval(ticker)
})
</script>

<style scoped>
/* Fixed colours on purpose: the emotes look the same in every theme. */
.emote-wheel {
  --fab: 58px;
  position: fixed;
  /* High enough for the half circle to open above and below the button. */
  right: max(14px, env(safe-area-inset-right, 0px));
  bottom: calc(140px + env(safe-area-inset-bottom, 0px));
  z-index: 60;
  width: var(--fab);
  height: var(--fab);
}

.emote-wheel__toggle {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  padding: 7px;
  place-items: center;
  border: 2px solid color-mix(in srgb, var(--piece-color, #22e8ff) 75%, transparent);
  border-radius: 50%;
  background: #1c1740;
  box-shadow: 0 12px 28px -10px rgba(0, 0, 0, 0.85), 0 0 22px -6px var(--piece-color, #22e8ff);
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
}

.emote-wheel__toggle:hover { transform: scale(1.07); }
.emote-wheel__toggle:active { transform: scale(0.94); }
.emote-wheel--open .emote-wheel__toggle { transform: rotate(-12deg) scale(1.05); }

.emote-wheel__face {
  display: block;
  width: 100%;
  height: 100%;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.emote-wheel--cooling .emote-wheel__toggle .emote-wheel__face { opacity: 0.4; filter: grayscale(0.8); }

/* Cooldown: a ring around the button that fills up as it recharges. */
.emote-wheel__ring {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px);
  height: calc(100% + 12px);
  transform: rotate(-90deg);
  pointer-events: none;
}

.emote-wheel__ring circle {
  fill: none;
  stroke: var(--piece-color, #22e8ff);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-dasharray: 1;
  transition: stroke-dashoffset 0.1s linear;
}

.emote-wheel__item--buzz .emote-wheel__ring circle { stroke: #ffd43b; }

.emote-wheel__fan {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.emote-wheel__item {
  --size: 56px;
  position: absolute;
  top: calc(var(--size) / -2);
  left: calc(var(--size) / -2);
  width: var(--size);
  height: var(--size);
  padding: 6px;
  border: 1.5px solid rgba(255, 255, 255, 0.38);
  border-radius: 50%;
  background: #1c1740;
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.85);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translate(0, 0) scale(0.3);
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay),
    opacity 0.18s ease var(--delay),
    visibility 0s linear 0.3s,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.emote-wheel--open .emote-wheel__item {
  opacity: 1;
  visibility: visible;
  transform: translate(var(--x), var(--y)) scale(1);
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay),
    opacity 0.18s ease var(--delay),
    visibility 0s,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.emote-wheel--open .emote-wheel__item:not(:disabled):hover,
.emote-wheel--open .emote-wheel__item:not(:disabled):focus-visible {
  border-color: var(--piece-color, #22e8ff);
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.85), 0 0 18px -2px var(--piece-color, #22e8ff);
  transform: translate(var(--x), var(--y)) scale(1.18);
  transition-delay: 0s;
}

.emote-wheel__item--off { cursor: not-allowed; }
.emote-wheel__item--off .emote-wheel__face { filter: grayscale(1); opacity: 0.38; }

.emote-wheel__item--buzz {
  --size: 62px;
  border-color: #ffd43b;
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.85), 0 0 18px -4px #ffd43b;
}

.emote-wheel__item--buzz.emote-wheel__item--off {
  border-color: rgba(255, 212, 59, 0.35);
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.85);
}

.emote-wheel--open .emote-wheel__item--buzz:not(.emote-wheel__item--off) {
  animation: emote-buzz-hint 1.6s ease-in-out 0.5s infinite;
}

@keyframes emote-buzz-hint {
  0%, 82%, 100% { rotate: 0deg; }
  86% { rotate: -9deg; }
  90% { rotate: 9deg; }
  94% { rotate: -6deg; }
}

@media (max-width: 700px) {
  .emote-wheel { --fab: 52px; }
}
</style>
