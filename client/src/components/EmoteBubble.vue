<!--
  The reaction a player just sent, with their name under it.
  - Default: pops out of whatever it is placed in (a player panel, a seat).
  - `floating`: a free-standing card, used by EmoteStage on narrow screens.
-->
<template>
  <span
    class="emote-bubble"
    :class="{ 'emote-bubble--buzz': emote === 'buzz', 'emote-bubble--floating': floating }"
    :style="{ '--piece-color': color }"
    role="status"
    :aria-label="`${name}: ${label}`"
  >
    <span class="emote-bubble__face"><TrikiEmote :emote="emote" animated /></span>
    <span class="emote-bubble__name">{{ name }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EmoteId, PlayerSlot } from '@/types/socket'
import { EMOTES } from '@/stores/emoteStore'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import TrikiEmote from './TrikiEmote.vue'

const props = withDefaults(defineProps<{
  slot: PlayerSlot
  emote: EmoteId
  floating?: boolean
}>(), { floating: false })

const gameStore = useGameStore()
const roomStore = useRoomStore()

const name = computed(() =>
  roomStore.players.find(player => player.slot === props.slot)?.username ?? `Jugador ${props.slot}`
)
const color = computed(() => gameStore.playerMeta[props.slot]?.color)
const label = computed(() =>
  props.emote === 'buzz' ? 'Zumbido' : EMOTES.find(emote => emote.id === props.emote)?.label ?? ''
)
</script>

<style scoped>
/* Fixed colours on purpose: the emotes look the same in every theme. */
.emote-bubble {
  position: absolute;
  top: -58px;
  right: -22px;
  z-index: 30;
  display: flex;
  width: 96px;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.emote-bubble--floating {
  position: static;
}

.emote-bubble__face {
  display: block;
  width: 92px;
  height: 92px;
  padding: 9px;
  border: 2px solid color-mix(in srgb, var(--piece-color, #22e8ff) 75%, transparent);
  border-radius: 50%;
  background: #1c1740;
  box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.8), 0 0 22px -6px var(--piece-color, #22e8ff);
}

.emote-bubble--buzz .emote-bubble__face {
  border-color: #ffd43b;
  box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.8), 0 0 26px -2px #ffd43b;
}

.emote-bubble__name {
  max-width: 120px;
  padding: 2px 10px;
  overflow: hidden;
  border: 1.5px solid color-mix(in srgb, var(--piece-color, #22e8ff) 75%, transparent);
  border-radius: 999px;
  background: #1c1740;
  color: #fff;
  font-family: 'Outfit', 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Narrow or upright screens: the panels may be off-screen, so EmoteStage
   shows the reactions instead. */
@media (max-width: 760px), (orientation: portrait) {
  .emote-bubble:not(.emote-bubble--floating) { display: none; }
}
</style>
