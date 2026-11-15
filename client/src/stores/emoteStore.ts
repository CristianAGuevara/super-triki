import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { PlayerSlot } from '@/types/socket'
import type { EmoteId } from '@/types/socket'
import { useAudioStore } from './audioStore'

/** Emotes are locked for this long after sending one. */
export const EMOTE_COOLDOWN_MS = 5_000
/** The buzz recharges on its own, slower clock. */
export const BUZZ_COOLDOWN_MS = 20_000
/** How long a reaction stays next to its player. */
const SHOW_MS = 2_800
const BUZZ_SHAKE_MS = 800

export const EMOTES: Array<{ id: Exclude<EmoteId, 'buzz'>; label: string }> = [
  { id: 'happy', label: 'Feliz' },
  { id: 'love', label: 'Enamorado' },
  { id: 'cool', label: 'Cool' },
  { id: 'sleepy', label: 'Dormido' },
  { id: 'crying', label: 'Llorando' },
  { id: 'angry', label: 'Enojado' },
]

export interface ShownEmote {
  emote: EmoteId
  /** Changes on every reaction so the same emote replays its entrance. */
  key: number
}

export const useEmoteStore = defineStore('emote', () => {
  const audioStore = useAudioStore()
  const shown = reactive<Partial<Record<PlayerSlot, ShownEmote>>>({})
  const cooldownUntil = ref(0)
  const buzzCooldownUntil = ref(0)
  const timers = new Map<PlayerSlot, number>()
  let sequence = 0
  let shakeTimer: number | null = null

  function shakeScreen() {
    const root = document.documentElement
    root.classList.remove('st-buzzing')
    // Restart the animation if a second buzz lands during the first.
    void root.offsetWidth
    root.classList.add('st-buzzing')
    if (shakeTimer) window.clearTimeout(shakeTimer)
    shakeTimer = window.setTimeout(() => root.classList.remove('st-buzzing'), BUZZ_SHAKE_MS)
    try {
      navigator.vibrate?.([70, 40, 70, 40, 120])
    } catch {
      // Vibration is a bonus.
    }
  }

  function receive(slot: PlayerSlot, emote: EmoteId, mySlot: PlayerSlot | null) {
    shown[slot] = { emote, key: ++sequence }
    const previous = timers.get(slot)
    if (previous) window.clearTimeout(previous)
    timers.set(slot, window.setTimeout(() => {
      delete shown[slot]
      timers.delete(slot)
    }, SHOW_MS))

    if (emote === 'buzz') {
      audioStore.playSfx('buzz')
      // The sender doesn't get shaken by their own buzz.
      if (slot !== mySlot) shakeScreen()
    } else {
      audioStore.playSfx('emote')
    }
  }

  function startCooldown() {
    cooldownUntil.value = Date.now() + EMOTE_COOLDOWN_MS
  }

  function clearCooldown() {
    cooldownUntil.value = 0
  }

  function startBuzzCooldown() {
    buzzCooldownUntil.value = Date.now() + BUZZ_COOLDOWN_MS
  }

  function clearBuzzCooldown() {
    buzzCooldownUntil.value = 0
  }

  return {
    shown,
    cooldownUntil,
    buzzCooldownUntil,
    receive,
    startCooldown,
    clearCooldown,
    startBuzzCooldown,
    clearBuzzCooldown,
  }
})
