<!-- The reaction a player just sent, popping out next to them. -->
<template>
  <Transition name="emote-pop">
    <span
      v-if="shown"
      :key="shown.key"
      class="emote-bubble"
      :class="{ 'emote-bubble--buzz': shown.emote === 'buzz' }"
      role="status"
      :aria-label="label"
    >
      <TrikiEmote :emote="shown.emote" animated />
    </span>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerSlot } from '@/types/socket'
import { EMOTES, useEmoteStore } from '@/stores/emoteStore'
import TrikiEmote from './TrikiEmote.vue'

const props = defineProps<{ slot: PlayerSlot }>()
const store = useEmoteStore()

const shown = computed(() => store.shown[props.slot] ?? null)
const label = computed(() => {
  if (!shown.value) return ''
  if (shown.value.emote === 'buzz') return 'Zumbido'
  return EMOTES.find(emote => emote.id === shown.value?.emote)?.label ?? ''
})
</script>

<style scoped>
.emote-bubble {
  position: absolute;
  top: -52px;
  right: -20px;
  z-index: 30;
  width: 92px;
  height: 92px;
  padding: 9px;
  border: 2px solid color-mix(in srgb, var(--piece-color, var(--accent-primary)) 70%, transparent);
  border-radius: 50% 50% 50% 12%;
  background: #1c1740;
  box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.8), 0 0 22px -6px var(--piece-color, var(--accent-primary));
  pointer-events: none;
}

.emote-bubble--buzz {
  border-color: #ffd43b;
  box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.8), 0 0 26px -2px #ffd43b;
}

.emote-pop-enter-active { animation: emote-pop-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.emote-pop-leave-active { animation: emote-pop-out 0.24s ease-in forwards; }

@keyframes emote-pop-in {
  0% { opacity: 0; transform: translateY(16px) scale(0.3) rotate(-18deg); }
  100% { opacity: 1; transform: none; }
}

@keyframes emote-pop-out {
  to { opacity: 0; transform: translateY(-12px) scale(0.6); }
}
</style>
